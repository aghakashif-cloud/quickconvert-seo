"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Tilt from "react-parallax-tilt";
import { useDropzone } from "react-dropzone";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  MonitorPlay,
  Upload,
  Sparkles,
  Smartphone,
  MousePointerClick,
  ShieldCheck,
  Sliders,
  Trash2,
  Repeat,
  Sun,
  RotateCcw,
  Box,
  Film,
  FileVideo,
  Video,
  Square,
  CheckCircle2,
  Share2,
} from "lucide-react";

type GlowThemeId = "indigo" | "cyan" | "rose" | "none";

const GLOW_THEMES: {
  id: GlowThemeId;
  label: string;
  swatch: string;
  auraClass: string;
  cardShadow: string;
}[] = [
  {
    id: "indigo",
    label: "Indigo Glow",
    swatch: "from-indigo-500 via-purple-500 to-pink-500",
    auraClass:
      "bg-gradient-to-r from-indigo-600/50 via-purple-600/45 to-pink-600/50",
    cardShadow: "shadow-[0_28px_75px_-12px_rgba(99,102,241,0.55)]",
  },
  {
    id: "cyan",
    label: "Cyber Cyan",
    swatch: "from-cyan-400 via-teal-500 to-emerald-500",
    auraClass:
      "bg-gradient-to-r from-cyan-500/50 via-teal-500/45 to-emerald-500/50",
    cardShadow: "shadow-[0_28px_75px_-12px_rgba(6,182,212,0.55)]",
  },
  {
    id: "rose",
    label: "Sunset Neon",
    swatch: "from-amber-500 via-orange-500 to-rose-500",
    auraClass:
      "bg-gradient-to-r from-amber-500/45 via-orange-500/45 to-rose-600/50",
    cardShadow: "shadow-[0_28px_75px_-12px_rgba(244,63,94,0.5)]",
  },
  {
    id: "none",
    label: "Minimal",
    swatch: "from-slate-600 to-slate-700",
    auraClass: "bg-slate-800/20",
    cardShadow: "shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]",
  },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function ThreeDVideoPlayerPage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoMeta, setVideoMeta] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 3D Tilt Settings (initialized to requested defaults)
  const [tiltAngle, setTiltAngle] = useState<number>(10);
  const [hoverScale, setHoverScale] = useState<number>(1.05);
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState<boolean>(true);
  const [glareEnabled, setGlareEnabled] = useState<boolean>(true);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true);
  const [glowThemeId, setGlowThemeId] = useState<GlowThemeId>("indigo");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Screen Capture / Record & Share state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordFeedback, setRecordFeedback] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up object URL on replace/unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Clean up any active screen recording on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach((track) => track.stop());
        captureStreamRef.current = null;
      }
    };
  }, []);

  const stopRecordingTracks = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else {
      stopRecordingTracks();
      setIsRecording(false);
    }
  }, [stopRecordingTracks]);

  const handleStartRecording = async () => {
    if (isRecording) return;
    setErrorMessage("");
    setRecordFeedback("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage(
        "Screen recording via getDisplayMedia is not supported in this browser. Try desktop Chrome, Edge, or Firefox, or use your device's built-in screen recorder."
      );
      return;
    }

    try {
      const displayOptions = {
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
      } catch (firstErr: unknown) {
        // If user explicitly cancelled the prompt, don't re-prompt
        if (
          firstErr instanceof DOMException &&
          (firstErr.name === "NotAllowedError" ||
            firstErr.name === "AbortError")
        ) {
          return;
        }
        // Fallback without audio/preferCurrentTab hints
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      }

      captureStreamRef.current = stream;
      recordedChunksRef.current = [];

      const candidateMimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const chosenMimeType =
        candidateMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ||
        "";

      const recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current = null;

        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, {
            type: chosenMimeType || "video/webm",
          });
          const downloadUrl = URL.createObjectURL(blob);
          const baseName = videoMeta?.name
            ? videoMeta.name.replace(/\.[^/.]+$/, "")
            : "3d-tilt-video";
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `${baseName}-3d-clip.webm`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
          setRecordFeedback(
            "3D clip downloaded (.webm)! Ready to share on TikTok, Reels & Shorts."
          );
        }
        recordedChunksRef.current = [];
      };

      // Also stop cleanly if user clicks the browser's built-in "Stop sharing" button
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        };
      }

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      stopRecordingTracks();
      setIsRecording(false);
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      ) {
        return;
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not start screen recording. Please grant tab/screen capture permission and try again."
      );
    }
  };

  const formatTimer = (totalSec: number): string => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleVideoFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isSupported =
      file.type === "video/mp4" ||
      file.type === "video/webm" ||
      ext === "mp4" ||
      ext === "webm";

    if (!isSupported) {
      setErrorMessage("Please select an MP4 or WebM video file.");
      return;
    }

    setErrorMessage("");
    const nextUrl = URL.createObjectURL(file);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setVideoMeta({
      name: file.name,
      size: file.size,
      type: file.type || (ext === "webm" ? "video/webm" : "video/mp4"),
    });
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleVideoFile(acceptedFiles[0]);
      }
    },
    [handleVideoFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4": [".mp4"],
      "video/webm": [".webm"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleVideoFile(file);
    }
    e.target.value = "";
  };

  const handleResetSettings = () => {
    setTiltAngle(10);
    setHoverScale(1.05);
    setGyroscopeEnabled(true);
    setGlareEnabled(true);
    setGlowThemeId("indigo");
  };

  const handleClearVideo = () => {
    if (isRecording) {
      handleStopRecording();
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl("");
    setVideoMeta(null);
    setErrorMessage("");
    setRecordFeedback("");
  };

  const activeGlow =
    GLOW_THEMES.find((t) => t.id === glowThemeId) || GLOW_THEMES[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 sm:py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <BackButton />

        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>Interactive 3D Parallax Cinema • Mouse &amp; Gyroscope</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            3D Tilt{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Video Player
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Play any local MP4 or WebM video inside an interactive 3D parallax
            stage with glowing ambient depth, smooth mouse hover tilt, and live
            mobile gyroscope motion—100% client-side with zero uploads.
          </p>
        </header>

        {/* Required Interactive Note */}
        <section
          aria-label="Interaction Tip"
          className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-4 py-3.5 flex flex-wrap items-center gap-3 text-indigo-200"
        >
          <div className="flex items-center gap-1.5 text-indigo-400 shrink-0">
            <MousePointerClick className="w-4 h-4" />
            <Smartphone className="w-4 h-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium leading-relaxed">
            Move your mouse over the video to see the 3D effect. On mobile, tilt
            your phone!
          </p>
        </section>

        {/* Hidden Quick-Replace File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {/* Upload Zone (when no video is loaded) */}
        {!videoUrl ? (
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xl shadow-black/30">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-14 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
                  : "border-slate-700 hover:border-indigo-500/70 bg-slate-950/60 hover:bg-slate-950"
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-base sm:text-lg font-bold text-white">
                {isDragActive
                  ? "Drop your MP4 or WebM video here..."
                  : "Upload an MP4 or WebM video to launch 3D Tilt mode"}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                Instant local playback • Files never leave your browser •
                Supports MP4 &amp; WebM
              </p>
              <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/25 transition">
                <FileVideo className="w-4 h-4" />
                Choose MP4 / WebM Video
              </div>
            </div>
          </section>
        ) : (
          /* Active 3D Tilt Cinema Stage */
          <section className="space-y-5">
            {/* Top Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  3D Tilt Active
                </span>
                {videoMeta && (
                  <span className="text-xs text-slate-300 truncate font-medium">
                    {videoMeta.name} ({formatBytes(videoMeta.size)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Change Video
                </button>
                <button
                  type="button"
                  onClick={handleClearVideo}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* 3D Perspective Cinema Stage with Glowing Ambient Depth */}
            <div className="relative rounded-3xl bg-slate-950/90 border border-slate-800/90 px-4 sm:px-10 py-10 sm:py-14 flex items-center justify-center overflow-hidden">
              {/* Subtle radial backdrop grid highlight */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12),transparent_68%)]" />

              <div className="relative w-full max-w-3xl mx-auto">
                {/* Glowing 3D ambient shadow behind video */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -inset-3 sm:-inset-5 rounded-3xl blur-3xl opacity-75 transition-all duration-500 ${activeGlow.auraClass}`}
                />

                <Tilt
                  tiltMaxAngleX={tiltAngle}
                  tiltMaxAngleY={tiltAngle}
                  scale={hoverScale}
                  gyroscope={gyroscopeEnabled}
                  perspective={1100}
                  transitionSpeed={450}
                  glareEnable={glareEnabled}
                  glareMaxOpacity={0.18}
                  glareColor="#ffffff"
                  glarePosition="all"
                  glareBorderRadius="1rem"
                  className={`relative rounded-2xl overflow-hidden border border-white/15 bg-black transition-shadow duration-500 ${activeGlow.cardShadow}`}
                >
                  <video
                    ref={videoRef}
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    loop={loopEnabled}
                    className="w-full max-h-[65vh] block bg-black object-contain rounded-2xl"
                  />
                </Tilt>
              </div>
            </div>

            {/* Record & Share Bar (below the video player) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 shrink-0 mt-0.5">
                    <Share2 className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">
                        Record &amp; Share 3D Clip
                      </h2>
                      {isRecording && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          REC {formatTimer(recordingSeconds)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Click Record, tilt the video with your mouse/finger, then
                      stop to download your 3D clip for TikTok/Reels!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Record 3D Effect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop Recording ({formatTimer(recordingSeconds)})
                    </button>
                  )}
                </div>
              </div>

              {recordFeedback && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{recordFeedback}</span>
                </div>
              )}
            </div>

            {/* 3D Tilt & Glow Controls */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  3D Parallax &amp; Ambient Glow Controls
                </h2>
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="tilt-angle"
                      className="font-semibold text-slate-300"
                    >
                      Max Tilt Angle (X &amp; Y)
                    </label>
                    <span className="font-mono font-bold text-indigo-300">
                      {tiltAngle}°
                    </span>
                  </div>
                  <input
                    id="tilt-angle"
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={tiltAngle}
                    onChange={(e) => setTiltAngle(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="hover-scale"
                      className="font-semibold text-slate-300"
                    >
                      Hover Pop-Out Scale
                    </label>
                    <span className="font-mono font-bold text-purple-300">
                      {hoverScale.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    id="hover-scale"
                    type="range"
                    min={1.0}
                    max={1.1}
                    step={0.01}
                    value={hoverScale}
                    onChange={(e) => setHoverScale(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Glow Theme Swatches + Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 mr-1">
                    Ambient Glow:
                  </span>
                  {GLOW_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setGlowThemeId(theme.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                        glowThemeId === theme.id
                          ? "bg-slate-800 border-indigo-400 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full bg-gradient-to-r ${theme.swatch}`}
                      />
                      {theme.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGyroscopeEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      gyroscopeEnabled
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Gyroscope: {gyroscopeEnabled ? "On" : "Off"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGlareEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      glareEnabled
                        ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Glare: {glareEnabled ? "On" : "Off"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoopEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                      loopEnabled
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    Loop: {loopEnabled ? "On" : "Off"}
                  </button>
                </div>
              </div>
            </div>
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
                100% Local Playback — Zero Uploads
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Your MP4 and WebM videos play directly from temporary browser
                memory using HTML5 video and hardware-accelerated CSS 3D
                transforms. Nothing is ever uploaded to any server.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/tools/image-to-3d"
              className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-semibold text-purple-200 transition flex items-center gap-1.5"
            >
              <Box className="w-3.5 h-3.5 text-purple-400" />
              Image to 3D
            </Link>
            <Link
              href="/tools/video-to-gif"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              Video to GIF
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              File Converter
            </Link>
          </div>
        </section>

        {/* Rich SEO Guide */}
        <ToolSeoContent
          toolName="3D Tilt Video Player"
          aboutParagraphs={[
            "Watching a product showcase, cinematic reel, gaming highlight, or presentation clip inside a flat rectangular box feels ordinary. Our free 3D Tilt Video Player transforms any local MP4 or WebM video into a floating, interactive 3D cinema card right inside your web browser.",
            "Powered by GPU-accelerated CSS 3D perspective transforms and live motion sensors, the player smoothly tilts as you move your cursor on desktop—or responds dynamically as you tilt your smartphone using its built-in gyroscope—framed by customizable glowing ambient light that enhances perceived depth on dark mode displays.",
          ]}
          howToSteps={[
            {
              title: "Upload an MP4 or WebM Video",
              detail:
                "Click Choose MP4 / WebM Video or drag and drop a local video clip into the dropzone. Playback begins immediately with zero waiting or cloud uploading.",
            },
            {
              title: "Move Your Mouse or Tilt Your Phone",
              detail:
                "Glide your cursor across the video player on desktop, or gently tilt your smartphone to experience real-time 3D parallax motion via gyroscope.",
            },
            {
              title: "Customize Depth, Scale & Ambient Glow",
              detail:
                "Adjust the Max Tilt Angle, Hover Pop-Out Scale, glowing shadow theme (Indigo, Cyber Cyan, Sunset Neon), cinema glare, and loop settings to match your video mood.",
            },
          ]}
          highlights={[
            "100% client-side HTML5 playback—zero file size limits imposed by cloud servers and total video privacy.",
            "Smooth hardware-accelerated 3D tilt (default 10° X/Y axis and 1.05× pop-out scale) with mobile gyroscope support.",
            "Customizable glowing ambient backdrop shadow and subtle glass glare tailored for dark-theme viewing.",
            "Works great for screen-recording interactive product demos, social media video previews, and portfolio showcases.",
          ]}
        />
      </div>
    </div>
  );
}
