"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  Box,
  Upload,
  Loader2,
  Camera,
  Video,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Sliders,
  Layers,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Play,
  Pause,
  Grid3X3,
  FlipVertical2,
} from "lucide-react";

const DepthSceneCanvas = dynamic(() => import("./DepthSceneCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      <p className="text-sm font-medium">Initializing 3D WebGL Engine...</p>
    </div>
  ),
});

interface DepthWorkerMessage {
  type: "model-progress" | "model-ready" | "inferring" | "complete" | "error";
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  fromCache?: boolean;
  width?: number;
  height?: number;
  rgbaBuffer?: ArrayBuffer;
  message?: string;
}

function resizeImageToDataUrl(
  img: HTMLImageElement,
  maxSide: number,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92
): string {
  const { naturalWidth: w, naturalHeight: h } = img;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize 2D canvas context.");
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL(mimeType, quality);
}

function rgbaBufferToPngDataUrl(
  rgbaBuffer: ArrayBuffer,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to render depth map canvas.");
  }
  const rgba = new Uint8ClampedArray(rgbaBuffer);
  const imageData = new ImageData(rgba, width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the selected image."));
    img.src = src;
  });
}

export default function ImageTo3DPage() {
  const [phase, setPhase] = useState<
    "idle" | "loading-model" | "generating" | "ready" | "error"
  >("idle");
  const [statusDetail, setStatusDetail] = useState<string>(
    "Upload any JPG, PNG, or WebP photo to create an interactive 3D parallax scene"
  );
  const [modelProgress, setModelProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [fileName, setFileName] = useState<string>("");
  const [fileDimensions, setFileDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [colorImageUrl, setColorImageUrl] = useState<string>("");
  const [depthMapUrl, setDepthMapUrl] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<number>(1.5);

  // Interactive 3D Controls
  const [depthStrength, setDepthStrength] = useState<number>(0.65);
  const [autoParallax, setAutoParallax] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [invertDepth, setInvertDepth] = useState<boolean>(false);
  const [showDepthPreview, setShowDepthPreview] = useState<boolean>(false);
  const [resetSignal, setResetSignal] = useState<number>(0);

  // Capture states
  const [snapshotFeedback, setSnapshotFeedback] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState<number>(0);

  const workerRef = useRef<Worker | null>(null);
  const modelFilesProgressRef = useRef<
    Record<string, { loaded: number; total: number; progress: number }>
  >({});
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup worker and timers on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL("./depth.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<DepthWorkerMessage>) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "model-progress") {
        setPhase("loading-model");
        const key = msg.file || "model";
        if (msg.status === "done") {
          modelFilesProgressRef.current[key] = {
            loaded: msg.total || 100,
            total: msg.total || 100,
            progress: 100,
          };
        } else if (
          typeof msg.loaded === "number" &&
          typeof msg.total === "number" &&
          msg.total > 0
        ) {
          modelFilesProgressRef.current[key] = {
            loaded: msg.loaded,
            total: msg.total,
            progress: Math.min(100, Math.round((msg.loaded / msg.total) * 100)),
          };
        } else if (typeof msg.progress === "number") {
          modelFilesProgressRef.current[key] = {
            loaded: msg.progress,
            total: 100,
            progress: Math.min(100, Math.round(msg.progress)),
          };
        }

        const entries = Object.values(modelFilesProgressRef.current);
        const totalBytes = entries.reduce((sum, item) => sum + item.total, 0);
        const loadedBytes = entries.reduce((sum, item) => sum + item.loaded, 0);
        const overall =
          totalBytes > 0
            ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
            : Math.min(99, Math.round(msg.progress ?? 0));

        setModelProgress(overall);
        setStatusDetail(
          "Downloading Depth Anything AI model to browser cache (first run only)..."
        );
      } else if (msg.type === "model-ready") {
        setModelProgress(100);
        setPhase("generating");
        setStatusDetail(
          msg.fromCache
            ? "Depth Anything model loaded from browser cache. Computing 3D depth map..."
            : "Depth Anything model ready. Computing 3D depth map..."
        );
      } else if (msg.type === "inferring") {
        setPhase("generating");
        setStatusDetail("Analyzing image perspective and generating depth map...");
      } else if (
        msg.type === "complete" &&
        msg.rgbaBuffer &&
        msg.width &&
        msg.height
      ) {
        try {
          const pngUrl = rgbaBufferToPngDataUrl(
            msg.rgbaBuffer,
            msg.width,
            msg.height
          );
          setDepthMapUrl(pngUrl);
          setPhase("ready");
          setStatusDetail("3D Parallax model ready! Drag to rotate or zoom.");
          setResetSignal((prev) => prev + 1);
        } catch (err: unknown) {
          setPhase("error");
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Failed to build depth map image."
          );
        }
      } else if (msg.type === "error") {
        setPhase("error");
        setErrorMessage(
          msg.message || "AI depth generation failed. Please try a smaller image."
        );
      }
    };

    worker.onerror = (err) => {
      setPhase("error");
      setErrorMessage(
        err.message || "Web Worker error while loading Depth Anything AI."
      );
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const processUploadedImage = useCallback(
    async (file: File) => {
      setErrorMessage("");
      setDepthMapUrl("");
      setFileName(file.name);
      setPhase("generating");
      setStatusDetail("Preparing image for client-side Depth Anything AI...");
      modelFilesProgressRef.current = {};

      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await loadImageElement(objectUrl);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        setFileDimensions({ width: w, height: h });
        setAspectRatio(w / h);

        // Keep crisp texture up to 1600px for Three.js, and compact <=640px for fast AI depth inference
        const displayDataUrl = resizeImageToDataUrl(img, 1600, "image/jpeg", 0.92);
        const inferenceDataUrl = resizeImageToDataUrl(img, 640, "image/jpeg", 0.9);
        setColorImageUrl(displayDataUrl);

        const worker = ensureWorker();
        worker.postMessage({
          type: "estimate-depth",
          imageDataUrl: inferenceDataUrl,
        });
      } catch (err: unknown) {
        setPhase("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not read the uploaded image."
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [ensureWorker]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processUploadedImage(acceptedFiles[0]);
      }
    },
    [processUploadedImage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    multiple: false,
    disabled: phase === "loading-model" || phase === "generating",
  });

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    webglCanvasRef.current = canvas;
  }, []);

  const handleTakeScreenshot = () => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const baseName = fileName
        ? fileName.replace(/\.[^/.]+$/, "")
        : "image-3d";
      link.download = `${baseName}-3d-snapshot.png`;
      link.href = dataUrl;
      link.click();
      setSnapshotFeedback("Snapshot saved!");
      setTimeout(() => setSnapshotFeedback(""), 2200);
    } catch {
      setErrorMessage("Could not capture snapshot from the WebGL canvas.");
    }
  };

  const handleDownloadDepthMap = () => {
    if (!depthMapUrl) return;
    const link = document.createElement("a");
    const baseName = fileName
      ? fileName.replace(/\.[^/.]+$/, "")
      : "image";
    link.download = `${baseName}-depth-map.png`;
    link.href = depthMapUrl;
    link.click();
  };

  const handleRecordVideo = () => {
    const canvas = webglCanvasRef.current;
    if (!canvas || isRecording) return;

    if (
      typeof canvas.captureStream !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage(
        "Your browser does not support canvas video recording. Use Take Screenshot instead."
      );
      return;
    }

    try {
      // Enable gentle auto-parallax during recording so the 5-second clip shows motion
      setAutoParallax(true);
      const stream = canvas.captureStream(30);
      const preferredMime = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9"
      )
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        setRecordSecondsLeft(0);
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const baseName = fileName
          ? fileName.replace(/\.[^/.]+$/, "")
          : "image-3d";
        link.download = `${baseName}-3d-parallax.webm`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSecondsLeft(5);

      let remaining = 5;
      recordTimerRef.current = setInterval(() => {
        remaining -= 1;
        setRecordSecondsLeft(Math.max(0, remaining));
        if (remaining <= 0) {
          if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
          }
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }
      }, 1000);
    } catch {
      setIsRecording(false);
      setErrorMessage(
        "Unable to start 3D video recording on this browser. Try Take Screenshot instead."
      );
    }
  };

  const handleClear = () => {
    setPhase("idle");
    setColorImageUrl("");
    setDepthMapUrl("");
    setFileName("");
    setFileDimensions(null);
    setErrorMessage("");
    setStatusDetail(
      "Upload any JPG, PNG, or WebP photo to create an interactive 3D parallax scene"
    );
  };

  const isProcessing = phase === "loading-model" || phase === "generating";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 sm:py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <BackButton />

        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Box className="w-3.5 h-3.5" />
            <span>Depth Anything AI + Three.js • 100% Client-Side</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Image to 3D{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Parallax Generator
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Turn any 2D photo into an interactive 3D parallax model directly in
            your browser. Client-side Depth Anything AI generates a depth map
            and renders it on a 3D Three.js mesh with OrbitControls—no server
            uploads required.
          </p>
        </header>

        {/* Required Mobile & Performance Warning */}
        <section
          aria-label="Performance Notice"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3.5 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-amber-100/95 leading-relaxed font-medium">
            Generating 3D from images is heavy. For best results on mobile, use
            small images.
          </p>
        </section>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="text-xs font-bold text-rose-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Dropzone (shown when idle, error without scene, or compact replace when ready) */}
        {phase !== "ready" && (
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xl shadow-black/30 space-y-5">
            {!isProcessing ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? "border-purple-400 bg-purple-500/10 scale-[1.01]"
                    : "border-slate-700 hover:border-indigo-500/70 bg-slate-950/60 hover:bg-slate-950"
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                <p className="text-base sm:text-lg font-bold text-white">
                  {isDragActive
                    ? "Drop your image here to generate 3D..."
                    : "Drag & drop an image here, or click to browse"}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                  Supports JPG, PNG, and WebP • Photos with a clear foreground
                  subject &amp; background look best
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/25 transition">
                  <Sparkles className="w-4 h-4" />
                  Select 2D Image
                </div>
              </div>
            ) : (
              /* Loading State: Generating 3D Depth... */
              <div className="py-10 sm:py-14 px-4 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
                  <Loader2 className="w-14 h-14 text-purple-400 animate-spin" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                    Generating 3D Depth...
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                    {statusDetail}
                  </p>
                </div>

                {phase === "loading-model" && (
                  <div className="max-w-md mx-auto space-y-2">
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 transition-all duration-300"
                        style={{ width: `${Math.max(4, modelProgress)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-mono text-indigo-300">
                      AI Model Cache Progress: {modelProgress}% (saved locally
                      for instant future runs)
                    </p>
                  </div>
                )}

                {colorImageUrl && (
                  <div className="pt-2 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={colorImageUrl}
                      alt="Uploaded source preview"
                      className="max-h-36 rounded-xl border border-slate-800 opacity-75 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Interactive 3D Viewport & Controls (shown once depth map is ready) */}
        {phase === "ready" && colorImageUrl && depthMapUrl && (
          <section className="space-y-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Top Viewport Toolbar */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0">
                    <Box className="w-3.5 h-3.5" />
                    3D Ready
                  </span>
                  <span className="text-xs text-slate-300 truncate font-medium">
                    {fileName}
                    {fileDimensions
                      ? ` (${fileDimensions.width}×${fileDimensions.height})`
                      : ""}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTakeScreenshot}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {snapshotFeedback || "Take Screenshot"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRecordVideo}
                    disabled={isRecording}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isRecording
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    {isRecording
                      ? `Recording (${recordSecondsLeft}s)...`
                      : "Record 5s Video"}
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    New Image
                  </button>
                </div>
              </div>

              {/* Three.js Interactive Canvas */}
              <div className="relative w-full h-[380px] sm:h-[520px] bg-[#060913]">
                <DepthSceneCanvas
                  imageUrl={colorImageUrl}
                  depthMapUrl={depthMapUrl}
                  aspectRatio={aspectRatio}
                  depthStrength={depthStrength}
                  autoParallax={autoParallax}
                  wireframe={wireframe}
                  invertDepth={invertDepth}
                  resetSignal={resetSignal}
                  onCanvasReady={handleCanvasReady}
                />

                {/* OrbitControls Floating Hint */}
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 font-medium">
                    Drag to rotate • Scroll / pinch to zoom • Right-drag to pan
                  </span>
                  {isRecording && (
                    <span className="px-3 py-1.5 rounded-xl bg-rose-600/90 text-white text-[11px] font-bold">
                      REC • Capturing 3D Parallax Loop ({recordSecondsLeft}s)
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom 3D Adjustment Controls */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 space-y-4">
                {/* Depth Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <label
                      htmlFor="depth-strength"
                      className="font-bold text-slate-200 flex items-center gap-1.5"
                    >
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      3D Displacement Depth:{" "}
                      <span className="font-mono text-indigo-300">
                        {depthStrength.toFixed(2)}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetSignal((prev) => prev + 1)}
                      className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Camera
                    </button>
                  </div>
                  <input
                    id="depth-strength"
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={depthStrength}
                    onChange={(e) => setDepthStrength(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Toggle Buttons Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAutoParallax((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      autoParallax
                        ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {autoParallax ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Auto-Parallax: {autoParallax ? "On" : "Off"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setInvertDepth((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      invertDepth
                        ? "bg-purple-600/20 border-purple-500/50 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <FlipVertical2 className="w-3.5 h-3.5" />
                    Invert Depth
                  </button>

                  <button
                    type="button"
                    onClick={() => setWireframe((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      wireframe
                        ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    Wireframe Mesh
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDepthPreview((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      showDepthPreview
                        ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {showDepthPreview ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    {showDepthPreview ? "Hide Depth Map" : "View AI Depth Map"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDepthMap}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Depth Map
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Side-by-Side Original & AI Depth Map Preview */}
            {showDepthPreview && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Original Photo vs. Generated AI Depth Map
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400">
                      Original 2D Image
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={colorImageUrl}
                      alt="Original uploaded 2D photo"
                      className="w-full max-h-64 object-contain rounded-xl bg-slate-950 border border-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400">
                      Depth Anything Map (Brighter = Closer)
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={depthMapUrl}
                      alt="AI generated grayscale depth map"
                      className="w-full max-h-64 object-contain rounded-xl bg-slate-950 border border-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Privacy Notice + Related Tools */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                100% Private In-Browser AI Processing
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Depth Anything runs locally inside a browser Web Worker via
                ONNX/WebAssembly and renders on your GPU with Three.js. Your
                personal photos never leave your device.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/tools/merge-images"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Merge Images
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              File Converter
            </Link>
            <Link
              href="/tools/ai-transcriber"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              AI Transcriber
            </Link>
          </div>
        </section>

        {/* Rich SEO Guide */}
        <ToolSeoContent
          toolName="Image to 3D Parallax Generator"
          aboutParagraphs={[
            "Have you ever wanted to transform a flat 2D portrait, landscape, or product shot into a dramatic 3D parallax scene without paying for expensive desktop software or uploading private photos to cloud AI servers? Our free Image to 3D Parallax Generator combines client-side monocular depth estimation (Depth Anything via Transformers.js) with real-time Three.js WebGL displacement rendering directly inside your web browser.",
            "Once you drop an image, the AI predicts how far every pixel sits from the camera—creating a grayscale depth map where brighter pixels represent foreground objects and darker pixels represent distant background elements. Three.js then wraps your original photo onto a high-resolution 3D mesh and extrudes vertices using that depth map so you can freely orbit, zoom, adjust depth intensity, record a 5-second WebM parallax loop, or download high-resolution PNG snapshots.",
          ]}
          howToSteps={[
            {
              title: "Upload Any 2D Photo",
              detail:
                "Drag and drop a JPG, PNG, or WebP image into the upload box. Portraits, pets, architecture, and street photography with clear foreground-background separation produce the sharpest 3D relief.",
            },
            {
              title: "Generate Client-Side AI Depth",
              detail:
                "Wait a few seconds while Depth Anything predicts the grayscale depth map locally inside a Web Worker. On your first visit, the compact quantized AI model caches automatically in your browser.",
            },
            {
              title: "Orbit, Customize & Export",
              detail:
                "Drag to rotate and scroll to zoom using OrbitControls, fine-tune the 3D Displacement Depth slider, toggle Auto-Parallax or Wireframe view, and click Take Screenshot or Record 5s Video to save your result.",
            },
          ]}
          highlights={[
            "Powered by Xenova/depth-anything-small-hf running locally via WebAssembly/ONNX in a non-blocking Web Worker.",
            "Interactive Three.js + React Three Fiber 3D mesh with OrbitControls, real-time displacement scaling, and optional wireframe inspection.",
            "Export crisp PNG snapshots, download the raw AI grayscale depth map for Blender or Photoshop, or record a 5-second 3D parallax WebM video.",
            "100% private with zero server uploads, zero watermarks, and no account required.",
          ]}
        />
      </div>
    </div>
  );
}
