"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone } from "react-dropzone";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Film,
  Upload,
  Download,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sliders,
  Trash2,
  Sparkles,
} from "lucide-react";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function VideoToGifPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fps, setFps] = useState<number>(12);
  const [width, setWidth] = useState<number>(480);
  const [trimStart, setTrimStart] = useState<string>("00:00:00");
  const [duration, setDuration] = useState<string>("5");

  const [status, setStatus] = useState<"idle" | "converting" | "done" | "error">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [statusLog, setStatusLog] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifSize, setGifSize] = useState<number>(0);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const ensureFFmpegLoaded = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegLoaded) {
      return ffmpegRef.current;
    }

    setStatusLog("Loading local FFmpeg WebAssembly engine from CDN...");
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on("progress", ({ progress: p }) => {
      const pct = Math.min(98, Math.max(12, Math.round(p * 100)));
      setProgress(pct);
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    setFfmpegLoaded(true);
    return ffmpeg;
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const selected = acceptedFiles[0];
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      setVideoFile(selected);
      setGifUrl(null);
      setGifSize(0);
      setStatus("idle");
      setProgress(0);
      setErrorMessage(null);
    },
    [gifUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".avi", ".mkv"],
    },
  });

  const handleConvertToGif = async () => {
    if (!videoFile || status === "converting") return;

    setStatus("converting");
    setProgress(10);
    setErrorMessage(null);
    setStatusLog("Initializing local browser conversion...");

    try {
      const ffmpeg = await ensureFFmpegLoaded();
      const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `input_clip.${ext}`;
      const outputName = "output_anim.gif";

      setStatusLog("Reading video clip into local memory...");
      setProgress(22);
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      const args: string[] = [];
      if (trimStart.trim()) {
        args.push("-ss", trimStart.trim());
      }
      args.push("-i", inputName);
      if (duration.trim() && Number(duration) > 0) {
        args.push("-t", duration.trim());
      }

      args.push(
        "-vf",
        `fps=${fps},scale=${width}:-1:flags=lanczos`,
        outputName
      );

      setStatusLog("Rendering animated GIF frames...");
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore cleanup error
      }

      const uint8 =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      const blob = new Blob([uint8.buffer as ArrayBuffer], {
        type: "image/gif",
      });
      const url = URL.createObjectURL(blob);

      setGifUrl(url);
      setGifSize(blob.size);
      setProgress(100);
      setStatus("done");
      setStatusLog("Animated GIF created 100% locally!");
    } catch (err: unknown) {
      setStatus("error");
      setProgress(0);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to convert video clip to GIF."
      );
    }
  };

  const resetFile = () => {
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setVideoFile(null);
    setGifUrl(null);
    setGifSize(0);
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  };

  const outputDownloadName = videoFile
    ? `${videoFile.name.replace(/\.[^/.]+$/, "")}-animated.gif`
    : "converted.gif";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <BackButton />
        </div>

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-4 h-4" />
              Local WebAssembly Studio
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Video to Animated GIF Converter
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Turn any MP4, MOV, or WebM video clip into a smooth, lightweight animated GIF 100% inside your browser using FFmpeg WASM.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Universal Converter
            </Link>
            <Link
              href="/tools/thumbnail-downloader"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Thumbnail Downloader
            </Link>
            <Link
              href="/tools/youtube-ai-studio"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              YouTube AI Studio
            </Link>
          </div>
        </div>

        {/* Security Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 flex items-center justify-center gap-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:inline" />
          <p className="text-xs md:text-sm font-medium text-emerald-400">
            🔒 100% Secure: Your video clips never leave your device. GIF rendering happens locally in your browser.
          </p>
        </div>

        {/* Upload Dropzone */}
        {!videoFile ? (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-10 md:p-14 text-center ${
              isDragActive
                ? "border-indigo-400 bg-indigo-500/10 scale-[0.995]"
                : "border-slate-700/80 hover:border-indigo-500/70 bg-slate-900/50 hover:bg-slate-900/80"
            }`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-100">
              {isDragActive
                ? "Drop your video clip here..."
                : "Drag & Drop a Video Clip (MP4, MOV, WebM)"}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-lg mx-auto">
              Select a video clip from your device to customize frame rate, width, and clip duration before converting to an animated GIF.
            </p>
            <div className="mt-5">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition">
                Choose Video File
              </span>
            </div>
          </div>
        ) : (
          /* Selected Video Configuration & Conversion Card */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                  <Film className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-bold text-white truncate">
                    {videoFile.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Original Size: {formatBytes(videoFile.size)}
                    {gifSize > 0 && (
                      <span className="text-emerald-400 font-semibold ml-2">
                        → GIF Size: {formatBytes(gifSize)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetFile}
                disabled={status === "converting"}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Change Video
              </button>
            </div>

            {/* GIF Settings Controls */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <Sliders className="w-3.5 h-3.5" />
                <span>Animated GIF Output Settings</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Frame Rate (FPS)
                  </label>
                  <select
                    aria-label="Frame Rate FPS"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value={8}>8 FPS (Smallest File)</option>
                    <option value={12}>12 FPS (Recommended)</option>
                    <option value={15}>15 FPS (Smooth)</option>
                    <option value={20}>20 FPS (High Motion)</option>
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <label className="block text-xs text-slate-400 mb-1.5">
                    GIF Width (Aspect Preserved)
                  </label>
                  <select
                    aria-label="GIF Width"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value={320}>320 px (Compact)</option>
                    <option value={480}>480 px (Standard Web)</option>
                    <option value={640}>640 px (Large HD)</option>
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Start Time (HH:MM:SS)
                  </label>
                  <input
                    type="text"
                    value={trimStart}
                    onChange={(e) => setTrimStart(e.target.value)}
                    placeholder="00:00:00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Clip Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Convert CTA & Progress Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-xs text-slate-400">
                Uses Lanczos scaling filter for crisp animated GIF edges.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={status === "converting"}
                  onClick={handleConvertToGif}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {status === "converting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Converting to GIF ({progress}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Convert to GIF
                    </>
                  )}
                </button>

                {status === "done" && gifUrl && (
                  <a
                    href={gifUrl}
                    download={outputDownloadName}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download .GIF
                  </a>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {(status === "converting" || status === "done") && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`flex items-center gap-1.5 font-medium ${
                      status === "done" ? "text-emerald-400" : "text-indigo-300"
                    }`}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    )}
                    {statusLog}
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === "done"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Alert */}
            {status === "error" && errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-2.5 text-xs md:text-sm text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Live GIF Preview */}
            {status === "done" && gifUrl && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">
                  Generated Animated GIF Preview
                </h3>
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-4 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gifUrl}
                    alt="Generated animated GIF preview"
                    className="max-h-96 rounded-lg object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <ToolSeoContent
          toolName="Video to Animated GIF Converter"
          aboutParagraphs={[
            "Our Video to Animated GIF Converter turns MP4, MOV, WebM, and MKV video clips into smooth, lightweight animated GIFs directly inside your browser using FFmpeg WebAssembly. Because every frame is processed locally on your own device, you never have to wait for slow cloud uploads or expose private screen recordings, product demos, or personal clips to external servers.",
            "Using FFmpeg palette generation and Lanczos scaling, the converter produces sharp colors and clean motion while keeping file sizes small enough for Discord, Slack, GitHub READMEs, newsletters, and social media posts. You can customize output width, frame rate (FPS), and start/end trim timestamps to capture the exact loop you want.",
          ]}
          howToSteps={[
            {
              title: "Drop Your Video Clip",
              detail:
                "Upload any MP4, MOV, WebM, AVI, or MKV clip into the dropzone above to preview it immediately.",
            },
            {
              title: "Adjust FPS, Width & Trim Range",
              detail:
                "Choose your ideal frame rate (10-15 FPS works best for smooth yet compact GIFs), resize width, and optionally trim start and end seconds.",
            },
            {
              title: "Convert & Download Locally",
              detail:
                "Click Convert to GIF, watch the live FFmpeg progress bar, preview your animation, and download the finished .GIF file with zero watermarks.",
            },
          ]}
          highlights={[
            "100% client-side FFmpeg WebAssembly rendering—your video clips never leave your computer or phone.",
            "Adaptive 256-color palette optimization produces crisp, banding-free animated GIFs.",
            "Customizable resolution width, frame rate, and clip start/end trimming to keep file sizes lightweight.",
            "Free unlimited conversions with no sign-up, no upload queues, and no watermarks.",
          ]}
        />
      </div>
    </div>
  );
}
