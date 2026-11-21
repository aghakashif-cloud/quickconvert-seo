"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone } from "react-dropzone";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Scissors,
  Upload,
  FileAudio,
  Sparkles,
  Play,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Flame,
  FileText,
  Trash2,
  Copy,
  Check,
  Video,
} from "lucide-react";

interface ClipSuggestion {
  title: string;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  viralityScore: number;
  hookQuote: string;
  whyItWorks: string;
  suggestedCaption: string;
  renderedClipUrl?: string;
  rendering?: boolean;
}

interface ClipperAnalysisResult {
  summary: string;
  detectedTranscriptSnippet: string;
  clips: ClipSuggestion[];
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

const SAMPLE_TRANSCRIPT = `[00:00] Most creators waste 4 hours uploading raw 4K footage to cloud video editors just to cut a 45-second TikTok or YouTube Short.
[00:18] Here is the secret nobody talks about: modern web browsers can now run full C++ FFmpeg inside WebAssembly right on your own laptop CPU.
[00:42] That means you can drop a 500MB video file into a browser tab, extract the audio track in 3 seconds with zero internet upload, and let Gemini AI pinpoint the exact 30-to-60-second viral hook.
[01:15] Even better, once the AI gives you the timestamps, FFmpeg WASM cuts the exact MP4 clip locally in memory so your private client footage never touches an external storage bucket.
[01:52] Try this workflow on your next podcast or tutorial upload and watch how fast you can turn one long video into five high-retention Shorts.`;

export default function AiVideoClipperPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Extracted audio state from FFmpeg.wasm
  const [extractingAudio, setExtractingAudio] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);
  const [extractedAudioBase64, setExtractedAudioBase64] = useState<string | null>(
    null
  );
  const [extractedAudioSize, setExtractedAudioSize] = useState<number>(0);

  // Transcript & Gemini AI analysis state
  const [transcript, setTranscript] = useState("");
  const [targetClipLength, setTargetClipLength] = useState("30-60 seconds");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusLog, setStatusLog] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<ClipperAnalysisResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Initialize FFmpeg.wasm from CDN
  const ensureFFmpegLoaded = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegLoaded) {
      return ffmpegRef.current;
    }

    setStatusLog("Initializing local FFmpeg.wasm engine from CDN...");
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.min(98, Math.max(10, Math.round(progress * 100)));
      setExtractionProgress(pct);
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    setFfmpegLoaded(true);
    setStatusLog("FFmpeg.wasm engine loaded & ready.");
    return ffmpeg;
  };

  // Handle video upload
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (extractedAudioUrl) URL.revokeObjectURL(extractedAudioUrl);

      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setExtractedAudioUrl(null);
      setExtractedAudioBase64(null);
      setExtractedAudioSize(0);
      setExtractionProgress(0);
      setAnalysisResult(null);
      setError(null);
      setStatusLog("Video loaded locally. Ready to extract audio via FFmpeg.wasm.");
    },
    [videoPreviewUrl, extractedAudioUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".mkv", ".avi"],
    },
  });

  // Step 1: Extract lightweight MP3 audio client-side using FFmpeg.wasm
  const handleExtractAudio = async () => {
    if (!videoFile || extractingAudio) return;

    setExtractingAudio(true);
    setExtractionProgress(10);
    setError(null);

    try {
      const ffmpeg = await ensureFFmpegLoaded();
      const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `source_video.${ext}`;
      const outputAudio = "extracted_audio.mp3";

      setStatusLog("Writing video into browser WebAssembly memory...");
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      setStatusLog(
        "Extracting compressed mono MP3 audio track via FFmpeg.wasm..."
      );
      // Extract compact mono 32kbps MP3 at 16kHz so it's fast and small enough for Gemini multimodal analysis
      const exitCode = await ffmpeg.exec([
        "-i",
        inputName,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "32k",
        outputAudio,
      ]);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg audio extraction exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputAudio);
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputAudio);
      } catch {
        // ignore virtual FS cleanup
      }

      const uint8 =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      const audioBlob = new Blob([uint8.buffer as ArrayBuffer], {
        type: "audio/mp3",
      });
      const audioUrl = URL.createObjectURL(audioBlob);

      setExtractedAudioUrl(audioUrl);
      setExtractedAudioSize(audioBlob.size);

      // Keep base64 payload if under 12MB so Gemini can analyze the audio directly even without a manual transcript
      if (uint8.byteLength <= 12 * 1024 * 1024) {
        setExtractedAudioBase64(uint8ArrayToBase64(uint8));
      }

      setExtractionProgress(100);
      setStatusLog(
        "Audio extracted 100% locally! Ready for Gemini AI viral segment detection."
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to extract audio with FFmpeg.wasm."
      );
    } finally {
      setExtractingAudio(false);
    }
  };

  // Step 2: Send transcript and/or extracted audio to /api/video-clipper (Gemini API)
  const handleFindEngagingSegments = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!transcript.trim() && !extractedAudioBase64) {
      setError(
        "Please either extract audio from your uploaded video first (Step 1) or paste a video transcript below."
      );
      return;
    }

    setAnalyzing(true);
    setError(null);
    setStatusLog(
      "Sending transcript / audio to Gemini AI to find the most engaging 30-60s segments..."
    );

    try {
      const response = await fetch("/api/video-clipper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim() || undefined,
          audioBase64: extractedAudioBase64 || undefined,
          audioMimeType: "audio/mp3",
          videoDurationSeconds: videoDuration || undefined,
          targetClipLength,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze segments with Gemini.");
      }

      setAnalysisResult(data);
      setStatusLog(
        `Gemini AI identified ${data.clips?.length || 0} high-retention video segments!`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during Gemini AI analysis."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // Bonus: Cut and download any AI-suggested 30-60s video segment directly in the browser using FFmpeg.wasm
  const handleCutVideoSegment = async (clipIndex: number) => {
    if (!videoFile || !analysisResult) return;
    const clip = analysisResult.clips[clipIndex];
    if (!clip || clip.rendering) return;

    setAnalysisResult((prev) => {
      if (!prev) return prev;
      const updated = [...prev.clips];
      updated[clipIndex] = { ...updated[clipIndex], rendering: true };
      return { ...prev, clips: updated };
    });

    try {
      const ffmpeg = await ensureFFmpegLoaded();
      const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `clip_src_${clipIndex}.${ext}`;
      const outputName = `viral_clip_${clipIndex}.mp4`;

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      const startSec = Math.max(0, clip.startSeconds || 0);
      const durationSec = Math.max(
        5,
        (clip.endSeconds || startSec + 30) - startSec
      );

      await ffmpeg.exec([
        "-ss",
        String(startSec),
        "-i",
        inputName,
        "-t",
        String(durationSec),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }

      const uint8 =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      const clipBlob = new Blob([uint8.buffer as ArrayBuffer], {
        type: "video/mp4",
      });
      const clipUrl = URL.createObjectURL(clipBlob);

      setAnalysisResult((prev) => {
        if (!prev) return prev;
        const updated = [...prev.clips];
        updated[clipIndex] = {
          ...updated[clipIndex],
          rendering: false,
          renderedClipUrl: clipUrl,
        };
        return { ...prev, clips: updated };
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to trim video clip."
      );
      setAnalysisResult((prev) => {
        if (!prev) return prev;
        const updated = [...prev.clips];
        updated[clipIndex] = { ...updated[clipIndex], rendering: false };
        return { ...prev, clips: updated };
      });
    }
  };

  const seekVideoTo = (seconds: number) => {
    if (videoElementRef.current) {
      videoElementRef.current.currentTime = seconds;
      videoElementRef.current.play().catch(() => {});
    }
  };

  const resetAll = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    if (extractedAudioUrl) URL.revokeObjectURL(extractedAudioUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setExtractedAudioUrl(null);
    setExtractedAudioBase64(null);
    setExtractedAudioSize(0);
    setExtractionProgress(0);
    setAnalysisResult(null);
    setError(null);
    setStatusLog("");
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <BackButton />
        </div>

        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-rose-400" />
              FFmpeg.wasm + Gemini AI Studio
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              AI Video Clipper &amp; Viral Segment Finder
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Upload a long-form video, extract its audio 100% client-side with FFmpeg.wasm, and use Gemini AI to pinpoint the most engaging 30–60 second Shorts &amp; Reels segments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/?tab=converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              File Converter
            </Link>
            <Link
              href="/tools/youtube-audit"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              YouTube SEO Audit
            </Link>
            <Link
              href="/?tab=youtube"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Metadata Studio
            </Link>
          </div>
        </div>

        {/* Zero-Upload Trust Notice */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 flex items-center justify-center gap-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:inline" />
          <p className="text-xs md:text-sm font-medium text-emerald-400">
            🔒 Client-Side Architecture: Your raw video file stays inside your browser. FFmpeg.wasm extracts the audio locally on your device.
          </p>
        </div>

        {/* STEP 1: Video Upload & Client-Side FFmpeg.wasm Audio Extraction */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <div>
                <h2 className="text-base md:text-lg font-bold text-white">
                  Upload Video &amp; Extract Audio Locally (FFmpeg.wasm)
                </h2>
                <p className="text-xs text-slate-400">
                  Drop an MP4, MOV, or WebM video to extract its audio track in the browser.
                </p>
              </div>
            </div>

            {videoFile && (
              <button
                type="button"
                onClick={resetAll}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs font-semibold text-slate-300 hover:text-rose-300 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Video
              </button>
            )}
          </div>

          {!videoFile ? (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-10 text-center ${
                isDragActive
                  ? "border-indigo-400 bg-indigo-500/10 scale-[0.995]"
                  : "border-slate-700/80 hover:border-indigo-500/70 bg-slate-950/60 hover:bg-slate-950/90"
              }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-3">
                <Upload className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-slate-100">
                {isDragActive
                  ? "Drop your video here..."
                  : "Drag & Drop a Video File (MP4, MOV, WebM)"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Your video is loaded directly into browser memory for local FFmpeg.wasm audio extraction and clipping.
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition">
                  Select Video from Device
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Video Player & File Metadata */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {videoPreviewUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video">
                    <video
                      ref={videoElementRef}
                      src={videoPreviewUrl}
                      controls
                      onLoadedMetadata={(e) =>
                        setVideoDuration(e.currentTarget.duration || 0)
                      }
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Video className="w-5 h-5 text-indigo-400 shrink-0" />
                      <span className="text-sm font-bold text-white truncate">
                        {videoFile.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Size: {formatBytes(videoFile.size)}</span>
                      {videoDuration > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            Duration: {Math.floor(videoDuration / 60)}m{" "}
                            {Math.round(videoDuration % 60)}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Extract Audio Button */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExtractAudio}
                      disabled={extractingAudio}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                    >
                      {extractingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting Audio ({extractionProgress}%)
                        </>
                      ) : extractedAudioUrl ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          Re-Extract Audio Track
                        </>
                      ) : (
                        <>
                          <FileAudio className="w-4 h-4" />
                          Extract Audio via FFmpeg.wasm
                        </>
                      )}
                    </button>

                    {extractedAudioUrl && (
                      <a
                        href={extractedAudioUrl}
                        download={`${videoFile.name.replace(/\.[^/.]+$/, "")}-audio.mp3`}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        Download Extracted MP3 ({formatBytes(extractedAudioSize)})
                      </a>
                    )}
                  </div>

                  {/* Audio Preview Player */}
                  {extractedAudioUrl && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Audio Extracted Locally &amp; Ready for Gemini AI
                        </span>
                        <span>{formatBytes(extractedAudioSize)}</span>
                      </div>
                      <audio
                        src={extractedAudioUrl}
                        controls
                        className="w-full h-8"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* FFmpeg Progress Bar */}
              {(extractingAudio || extractionProgress > 0) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>{statusLog}</span>
                    <span className="font-mono font-bold">
                      {extractionProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        extractionProgress === 100
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-indigo-500 to-purple-500"
                      }`}
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: Transcript & Gemini AI Viral Clip Detection */}
        <form
          onSubmit={handleFindEngagingSegments}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-base md:text-lg font-bold text-white">
                  Analyze with Gemini AI for 30–60s Engaging Segments
                </h2>
                <p className="text-xs text-slate-400">
                  Gemini analyzes your extracted audio track and/or transcript to pinpoint high-retention hooks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
            >
              Load Sample Transcript
            </button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="clipper-transcript-input"
              className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Video Transcript or Timestamped Notes (Optional if audio was extracted above)
            </label>
            <textarea
              id="clipper-transcript-input"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your video transcript, captions (.SRT/.VTT), or topic summary here, or extract the audio in Step 1 to let Gemini listen directly..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 font-medium">
                Target Segment Length:
              </label>
              <select
                aria-label="Target Segment Length"
                value={targetClipLength}
                onChange={(e) => setTargetClipLength(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
              >
                <option value="30-60 seconds">30–60 Seconds (Shorts / Reels)</option>
                <option value="15-30 seconds">15–30 Seconds (Fast TikTok Hook)</option>
                <option value="60-90 seconds">60–90 Seconds (Deep Story Clip)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding Engaging 30–60s Clips...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find Viral Segments with Gemini AI
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-xs md:text-sm text-rose-300">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 3: Gemini AI Identified Viral Segments */}
        {analysisResult && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <Sparkles className="w-4 h-4" />
                AI Content Overview
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {analysisResult.summary}
              </p>
              {analysisResult.detectedTranscriptSnippet && (
                <p className="text-xs text-slate-400 italic border-l-2 border-indigo-500/40 pl-3">
                  &ldquo;{analysisResult.detectedTranscriptSnippet}&rdquo;
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400" />
                Recommended Engaging Segments ({analysisResult.clips?.length || 0}{" "}
                Clips Found)
              </h3>

              <div className="grid grid-cols-1 gap-5">
                {analysisResult.clips?.map((clip, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-6 space-y-4 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {clip.startTime} — {clip.endTime}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                          Virality Score: {clip.viralityScore}/100
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {videoPreviewUrl && (
                          <button
                            type="button"
                            onClick={() => seekVideoTo(clip.startSeconds || 0)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 text-indigo-400" />
                            Preview Moment
                          </button>
                        )}

                        {videoFile && !clip.renderedClipUrl && (
                          <button
                            type="button"
                            onClick={() => handleCutVideoSegment(idx)}
                            disabled={clip.rendering}
                            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
                          >
                            {clip.rendering ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Trimming Clip...
                              </>
                            ) : (
                              <>
                                <Scissors className="w-3.5 h-3.5" />
                                Cut MP4 Clip Locally
                              </>
                            )}
                          </button>
                        )}

                        {clip.renderedClipUrl && (
                          <a
                            href={clip.renderedClipUrl}
                            download={`viral-clip-${idx + 1}-${clip.startTime.replace(":", "m")}s.mp4`}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Clip (.MP4)
                          </a>
                        )}
                      </div>
                    </div>

                    <h4 className="text-base md:text-lg font-bold text-white">
                      Clip #{idx + 1}: {clip.title}
                    </h4>

                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs md:text-sm text-indigo-200 italic">
                      &ldquo;{clip.hookQuote}&rdquo;
                    </div>

                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                      <strong className="text-slate-100">Why it works: </strong>
                      {clip.whyItWorks}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-400">
                        <strong className="text-slate-300">Caption: </strong>
                        {clip.suggestedCaption}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(clip.suggestedCaption, `cap-${idx}`)
                        }
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        {copiedId === `cap-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy Caption
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <ToolSeoContent
          toolName="AI Video Clipper & Viral Segment Finder"
          aboutParagraphs={[
            "The AI Video Clipper & Viral Segment Finder helps podcast hosts, educators, and YouTube creators repurpose long-form videos into punchy 30 to 60 second YouTube Shorts, Instagram Reels, and TikTok clips. Instead of scrubbing through an entire recording manually, the tool extracts a compact audio track 100% locally inside your browser using FFmpeg WebAssembly and analyzes the spoken moments with Gemini AI to identify the highest-retention hooks and standout takeaways.",
            "For every suggested viral segment, you receive exact start and end timestamps, a hook explanation, and a ready-to-copy social caption—plus one-click local video trimming via FFmpeg WASM so you can preview and download each short clip straight from your browser with zero server video uploads.",
          ]}
          howToSteps={[
            {
              title: "Upload Your Long-Form Video",
              detail:
                "Drop an MP4, MOV, or WebM video file into the upload zone to load it locally in your browser.",
            },
            {
              title: "Find Viral 30-60s Segments",
              detail:
                "Click Analyze Video to extract audio via FFmpeg WASM and let Gemini AI pinpoint the most engaging short-form moments with timestamps.",
            },
            {
              title: "Trim & Download Clips Locally",
              detail:
                "Review the recommended clips, copy the suggested captions, and export trimmed video segments directly to your device.",
            },
          ]}
          highlights={[
            "Extracts audio and trims final video clips locally in your browser via FFmpeg WebAssembly—your full video never uploads to a server.",
            "Pinpoints 30 to 60 second high-retention moments ideal for YouTube Shorts, TikTok, and Instagram Reels.",
            "Provides exact timestamp ranges, virality reasoning, and copy-ready social media captions for every clip.",
            "Fast, free creator workflow requiring no desktop video editor or paid clipping subscription.",
          ]}
        />
      </div>
    </div>
  );
}
