"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { useDropzone } from "react-dropzone";
import { FFmpeg, type FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Mic,
  Upload,
  FileAudio,
  FileVideo,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Check,
  Download,
  Trash2,
  Cpu,
  Clock,
  FileText,
  Globe,
  Info,
} from "lucide-react";

type WhisperModelId =
  | "Xenova/whisper-tiny"
  | "Xenova/whisper-base"
  | "Xenova/whisper-small";

interface LanguageOption {
  code: string;
  label: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "auto", label: "Auto-detect (first 30s)" },
  { code: "en", label: "English (en)" },
  { code: "ur", label: "Urdu — اردو (ur)" },
  { code: "hi", label: "Hindi — हिन्दी (hi)" },
  { code: "ar", label: "Arabic — العربية (ar)" },
  { code: "pa", label: "Punjabi (pa)" },
  { code: "fa", label: "Persian — فارسی (fa)" },
  { code: "ps", label: "Pashto — پښتو (ps)" },
  { code: "bn", label: "Bengali (bn)" },
  { code: "tr", label: "Turkish (tr)" },
  { code: "es", label: "Spanish (es)" },
  { code: "fr", label: "French (fr)" },
  { code: "de", label: "German (de)" },
  { code: "pt", label: "Portuguese (pt)" },
  { code: "it", label: "Italian (it)" },
  { code: "ru", label: "Russian (ru)" },
  { code: "zh", label: "Chinese (zh)" },
  { code: "ja", label: "Japanese (ja)" },
  { code: "ko", label: "Korean (ko)" },
];

function getLanguageLabel(code: string): string {
  const match = LANGUAGE_OPTIONS.find((opt) => opt.code === code);
  if (match) return match.label;
  return code.toUpperCase();
}

interface TranscriptChunk {
  timestamp: [number, number | null];
  text: string;
}

interface WorkerMessage {
  type:
    | "model-progress"
    | "model-ready"
    | "detecting-language"
    | "language-detected"
    | "transcribe-progress"
    | "complete"
    | "error";
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  model?: string;
  fromCache?: boolean;
  language?: string;
  autoDetected?: boolean;
  fallback?: boolean;
  chunksProcessed?: number;
  estimatedChunks?: number;
  text?: string;
  chunks?: TranscriptChunk[];
  message?: string;
}

const MAX_RECOMMENDED_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "wmv",
  "flv",
  "3gp",
]);

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimestamp(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  if (file.type.startsWith("audio/")) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * Decodes an ArrayBuffer of audio into a 16kHz mono Float32Array PCM waveform
 * matching OpenAI Whisper's expected sample rate.
 */
async function decodeAudioTo16kHzMono(
  arrayBuffer: ArrayBuffer
): Promise<{ pcm: Float32Array; duration: number }> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const audioCtx = new AudioCtx({ sampleRate: 16000 });
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    let targetBuffer = decoded;

    // Resample via OfflineAudioContext if the browser ignored the 16kHz sampleRate hint
    if (decoded.sampleRate !== 16000) {
      const targetLength = Math.max(1, Math.ceil(decoded.duration * 16000));
      const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start(0);
      targetBuffer = await offlineCtx.startRendering();
    }

    let pcm: Float32Array;
    if (targetBuffer.numberOfChannels === 2) {
      const left = targetBuffer.getChannelData(0);
      const right = targetBuffer.getChannelData(1);
      const scalingFactor = Math.sqrt(2);
      pcm = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        pcm[i] = (scalingFactor * (left[i] + right[i])) / 2;
      }
    } else if (targetBuffer.numberOfChannels > 2) {
      const length = targetBuffer.length;
      const numChannels = targetBuffer.numberOfChannels;
      pcm = new Float32Array(length);
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = targetBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          pcm[i] += channelData[i] / numChannels;
        }
      }
    } else {
      pcm = new Float32Array(targetBuffer.getChannelData(0));
    }

    return { pcm, duration: targetBuffer.duration };
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

export default function AudioTranscriberPage() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<WhisperModelId>(
    "Xenova/whisper-small"
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [detectedLanguageInfo, setDetectedLanguageInfo] = useState<{
    code: string;
    autoDetected: boolean;
    fallback?: boolean;
  } | null>(null);

  // Overall state
  const [phase, setPhase] = useState<
    | "idle"
    | "processing-file"
    | "loading-model"
    | "transcribing"
    | "done"
    | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Progress bar 1: File Processing & Audio Extraction / Transcription progress
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [fileStatusText, setFileStatusText] = useState<string>(
    "Waiting for media file..."
  );

  // Progress bar 2: AI Model Loading progress
  const [modelProgress, setModelProgress] = useState<number>(0);
  const [modelStatusText, setModelStatusText] = useState<string>(
    "AI model loads automatically when you click Transcribe"
  );
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);

  // Transcript output state
  const [transcript, setTranscript] = useState<string>("");
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [includeTimestamps, setIncludeTimestamps] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Refs for FFmpeg, Worker, and model file progress aggregation
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef<boolean>(false);
  const workerRef = useRef<Worker | null>(null);
  const modelFilesProgressRef = useRef<
    Record<string, { loaded: number; total: number; progress: number }>
  >({});
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup worker, FFmpeg WASM, & timers on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (ffmpegRef.current) {
        try {
          ffmpegRef.current.terminate();
        } catch {
          // ignore
        }
        ffmpegRef.current = null;
        ffmpegLoadedRef.current = false;
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  const ensureWorker = (): Worker => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "model-progress") {
        setPhase("loading-model");
        const fileKey = msg.file || "model";

        if (msg.status === "done") {
          modelFilesProgressRef.current[fileKey] = {
            loaded: msg.total || 100,
            total: msg.total || 100,
            progress: 100,
          };
        } else if (
          typeof msg.loaded === "number" &&
          typeof msg.total === "number" &&
          msg.total > 0
        ) {
          modelFilesProgressRef.current[fileKey] = {
            loaded: msg.loaded,
            total: msg.total,
            progress: Math.min(100, Math.round((msg.loaded / msg.total) * 100)),
          };
        } else if (typeof msg.progress === "number") {
          modelFilesProgressRef.current[fileKey] = {
            loaded: msg.progress,
            total: 100,
            progress: Math.min(100, Math.round(msg.progress)),
          };
        } else if (!modelFilesProgressRef.current[fileKey]) {
          modelFilesProgressRef.current[fileKey] = {
            loaded: 0,
            total: 100,
            progress: 0,
          };
        }

        const entries = Object.values(modelFilesProgressRef.current);
        const totalBytes = entries.reduce((acc, item) => acc + item.total, 0);
        const loadedBytes = entries.reduce((acc, item) => acc + item.loaded, 0);
        const overallPct =
          totalBytes > 0
            ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
            : Math.min(99, Math.round(msg.progress ?? 0));

        setModelProgress(overallPct);
        const shortFileName = msg.file
          ? msg.file.split("/").pop() || msg.file
          : "Whisper weights";
        setModelStatusText(
          `Loading ${shortFileName} (${overallPct}%) — cached locally after first run`
        );
      } else if (msg.type === "model-ready") {
        setModelProgress(100);
        setLoadedModelId(msg.model || null);
        setModelStatusText(
          msg.fromCache
            ? `Whisper model ready from memory (${msg.model})`
            : `Whisper model loaded & cached locally (${msg.model})`
        );
        setPhase("transcribing");
        setFileProgress(55);
        setFileStatusText("Running Whisper AI speech recognition locally...");
      } else if (msg.type === "detecting-language") {
        setPhase("transcribing");
        setFileProgress(54);
        setFileStatusText(
          "Auto-detecting audio language from the first 30 seconds..."
        );
      } else if (msg.type === "language-detected") {
        const langCode = msg.language || "en";
        setDetectedLanguageInfo({
          code: langCode,
          autoDetected: Boolean(msg.autoDetected),
          fallback: Boolean(msg.fallback),
        });
        setPhase("transcribing");
        setFileProgress(56);
        setFileStatusText(
          msg.fallback
            ? `Auto-detect defaulted to ${getLanguageLabel(langCode)} — tip: select a specific language for higher accuracy.`
            : `Detected language: ${getLanguageLabel(langCode)} — transcribing locally...`
        );
      } else if (msg.type === "transcribe-progress") {
        setPhase("transcribing");
        // Map transcription 0-100% into the 55-98% band of the file processing progress bar
        const subPct = msg.progress ?? 0;
        const mappedPct = Math.min(98, Math.max(55, Math.round(55 + subPct * 0.43)));
        setFileProgress(mappedPct);
        const langSuffix = msg.language ? ` [${msg.language.toUpperCase()}]` : "";
        setFileStatusText(
          `Transcribing speech locally${langSuffix} (chunk ${msg.chunksProcessed ?? 0}/${
            msg.estimatedChunks ?? 1
          })...`
        );
      } else if (msg.type === "complete") {
        setTranscript(msg.text || "");
        setChunks(msg.chunks || []);
        if (msg.language) {
          setDetectedLanguageInfo((prev) => ({
            code: msg.language as string,
            autoDetected: Boolean(msg.autoDetected),
            fallback: prev?.fallback,
          }));
        }
        setFileProgress(100);
        setModelProgress(100);
        setFileStatusText("Transcription completed 100% locally in your browser!");
        setPhase("done");
      } else if (msg.type === "error") {
        setPhase("error");
        setErrorMessage(
          msg.message ||
            "Whisper AI failed to transcribe this file. Try a smaller clip or switch to Whisper Base / Tiny."
        );
      }
    };

    worker.onerror = (err) => {
      setPhase("error");
      setErrorMessage(
        err.message ||
          "Web Worker encountered an error while loading Transformers.js."
      );
    };

    workerRef.current = worker;
    return worker;
  };

  const ensureFFmpegLoaded = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegLoadedRef.current) {
      return ffmpegRef.current;
    }

    setFileStatusText("Loading FFmpeg WebAssembly engine to extract video audio...");
    setFileProgress(8);

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on("progress", ({ progress }) => {
      // Map FFmpeg audio extraction to 15% - 45% of file processing progress
      const clamped = Math.min(1, Math.max(0, progress));
      setFileProgress(Math.round(15 + clamped * 30));
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegLoadedRef.current = true;
    return ffmpeg;
  };

  const releaseFFmpegMemory = () => {
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.terminate();
      } catch {
        // ignore termination error
      }
      ffmpegRef.current = null;
      ffmpegLoadedRef.current = false;
    }
  };

  /**
   * Streams/mounts the media file via WORKERFS so FFmpeg reads chunks on demand
   * without copying a multi-GB file into browser RAM, then immediately releases
   * all virtual filesystem files and terminates the FFmpeg WASM heap before Whisper runs.
   */
  const extractWavViaFFmpeg = async (file: File): Promise<ArrayBuffer> => {
    const ffmpeg = await ensureFFmpegLoaded();
    const mountDir = "/input";
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const fallbackInputName = `input_media.${ext}`;
    const outputName = "extracted_16k.wav";

    let usedWorkerFS = false;
    let inputPath = "";

    try {
      setFileStatusText(
        "Mounting media stream via FFmpeg WORKERFS (low-memory mode)..."
      );
      setFileProgress(14);

      try {
        await ffmpeg.createDir(mountDir);
      } catch {
        // directory may already exist
      }

      try {
        await ffmpeg.mount("WORKERFS" as FFFSType, { files: [file] }, mountDir);
        usedWorkerFS = true;
        inputPath = `${mountDir}/${file.name}`;
      } catch {
        // WORKERFS not available; only fall back to writeFile for files <= 200MB
        if (file.size > MAX_RECOMMENDED_FILE_SIZE) {
          throw new Error(
            "This file exceeds 200MB and could not be streamed into browser memory. Please compress or split it into a smaller file (under 200MB) and try again."
          );
        }
        setFileStatusText("Reading media file into local WebAssembly memory...");
        await ffmpeg.writeFile(fallbackInputName, await fetchFile(file));
        inputPath = fallbackInputName;
      }

      setFileStatusText("Extracting 16kHz mono audio track via FFmpeg WASM...");
      const exitCode = await ffmpeg.exec([
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        outputName,
      ]);

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg failed to extract audio from this file (exit code ${exitCode}). Ensure the video contains an audio track and is under 200MB for best stability.`
        );
      }

      const data = await ffmpeg.readFile(outputName);
      const uint8 =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      return uint8.slice().buffer;
    } finally {
      // Immediately free virtual FS buffers and terminate FFmpeg WASM heap before Whisper loads
      try {
        if (usedWorkerFS) {
          await ffmpeg.unmount(mountDir);
          await ffmpeg.deleteDir(mountDir);
        } else if (inputPath) {
          await ffmpeg.deleteFile(inputPath);
        }
      } catch {
        // ignore cleanup error
      }
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore cleanup error
      }
      releaseFFmpegMemory();
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const selected = acceptedFiles[0];
    const videoFlag = isVideoFile(selected);

    setMediaFile(selected);
    setMediaPreviewUrl(URL.createObjectURL(selected));
    setIsVideo(videoFlag);
    setPhase("idle");
    setErrorMessage(null);
    setTranscript("");
    setChunks([]);
    setDetectedLanguageInfo(null);
    setFileProgress(0);
    setFileStatusText(
      videoFlag
        ? "Video selected. FFmpeg will extract the audio track locally before transcription."
        : "Audio file selected. Ready to transcribe locally with Whisper AI."
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".webm"],
      "video/*": [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"],
    },
  });

  const handleTranscribe = async () => {
    if (
      !mediaFile ||
      phase === "processing-file" ||
      phase === "loading-model" ||
      phase === "transcribing"
    ) {
      return;
    }

    setErrorMessage(null);
    setTranscript("");
    setChunks([]);
    setDetectedLanguageInfo(null);
    setPhase("processing-file");
    setFileProgress(5);

    if (loadedModelId !== selectedModel) {
      modelFilesProgressRef.current = {};
      setModelProgress(0);
      setModelStatusText(`Preparing to load ${selectedModel}...`);
    } else {
      setModelProgress(100);
      setModelStatusText(`Whisper model already loaded in memory (${selectedModel})`);
    }

    try {
      let audioBufferBytes: ArrayBuffer;

      // Use FFmpeg WORKERFS streaming for all videos AND for large audio files (> 200MB)
      if (isVideo || mediaFile.size > MAX_RECOMMENDED_FILE_SIZE) {
        audioBufferBytes = await extractWavViaFFmpeg(mediaFile);
      } else {
        setFileStatusText("Reading audio file locally...");
        setFileProgress(25);
        audioBufferBytes = await mediaFile.arrayBuffer();
      }

      setFileStatusText("Decoding audio waveform to 16kHz mono PCM...");
      setFileProgress(48);

      let decodedAudio: { pcm: Float32Array; duration: number };
      try {
        decodedAudio = await decodeAudioTo16kHzMono(audioBufferBytes);
      } catch {
        // Fallback: if browser Web Audio API cannot decode an audio format (e.g., certain MKV/FLAC/M4A), transcode via FFmpeg first
        setFileStatusText(
          "Converting audio format via FFmpeg WASM for browser compatibility..."
        );
        const wavBytes = await extractWavViaFFmpeg(mediaFile);
        decodedAudio = await decodeAudioTo16kHzMono(wavBytes);
      }

      // Drop reference to raw audio bytes so GC can reclaim RAM immediately
      audioBufferBytes = new ArrayBuffer(0);

      setFileProgress(52);
      setFileStatusText(
        `Audio prepared (${formatTimestamp(decodedAudio.duration)} duration). Handing off to Whisper AI...`
      );

      if (loadedModelId !== selectedModel) {
        setPhase("loading-model");
        setModelProgress(5);
        setModelStatusText(`Downloading / initializing ${selectedModel}...`);
      } else {
        setPhase("transcribing");
      }

      const strictLanguage = selectedLanguage === "ur" ? "ur" : selectedLanguage;
      const worker = ensureWorker();
      // Transfer the underlying ArrayBuffer to the Web Worker with zero copy overhead
      worker.postMessage(
        {
          type: "transcribe",
          audio: decodedAudio.pcm,
          model: selectedModel,
          language: strictLanguage,
          durationSeconds: decodedAudio.duration,
        },
        [decodedAudio.pcm.buffer]
      );
    } catch (err: unknown) {
      setPhase("error");
      const rawMsg = err instanceof Error ? err.message : "";
      const isMemoryOrReadErr =
        rawMsg.includes("Code=-1") ||
        rawMsg.toLowerCase().includes("could not be read") ||
        rawMsg.toLowerCase().includes("out of memory") ||
        rawMsg.toLowerCase().includes("allocation failed");

      setErrorMessage(
        isMemoryOrReadErr
          ? "Browser memory limit reached while reading this file. For best performance, please use files smaller than 200MB (or convert your video to an MP3 first using our File Converter)."
          : rawMsg || "Failed to process the uploaded media file."
      );
    }
  };

  const resetFile = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setIsVideo(false);
    setPhase("idle");
    setErrorMessage(null);
    setTranscript("");
    setChunks([]);
    setDetectedLanguageInfo(null);
    setFileProgress(0);
    setFileStatusText("Waiting for media file...");
  };

  const formattedTranscript =
    includeTimestamps && chunks.length > 0
      ? chunks
          .map(
            (c) =>
              `[${formatTimestamp(c.timestamp?.[0])} - ${formatTimestamp(
                c.timestamp?.[1]
              )}] ${c.text.trim()}`
          )
          .join("\n")
      : transcript;

  const handleCopyTranscript = async () => {
    if (!formattedTranscript) return;
    try {
      await navigator.clipboard.writeText(formattedTranscript);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadTxt = () => {
    if (!formattedTranscript) return;
    const blob = new Blob([formattedTranscript], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = mediaFile
      ? mediaFile.name.replace(/\.[^/.]+$/, "")
      : "transcript";
    a.href = url;
    a.download = `${baseName}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isBusy =
    phase === "processing-file" ||
    phase === "loading-model" ||
    phase === "transcribing";

  const isLargeFile = Boolean(
    mediaFile && mediaFile.size > MAX_RECOMMENDED_FILE_SIZE
  );

  const wordCount = formattedTranscript.trim()
    ? formattedTranscript.trim().split(/\s+/).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="w-4 h-4" />
              Local Whisper AI • Transformers.js + FFmpeg WASM
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              AI Audio/Video Transcriber
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Upload any audio or video file to generate an accurate text transcript 100% locally in your browser—completely free and private.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/ai-video-clipper"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              AI Video Clipper
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
              YouTube AI Studio
            </Link>
          </div>
        </div>

        {/* Privacy Badge + Required Local Processing Warning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-emerald-300">
              100% Private: Zero server uploads. Whisper AI &amp; FFmpeg run strictly inside your browser.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-medium text-amber-200">
              Processing happens locally in your browser. Large files may take longer and use more RAM.
            </p>
          </div>
        </div>

        {/* Model Selector Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Whisper AI Model (Multilingual • 99 Languages)
                </h2>
                <p className="text-xs text-slate-400">
                  Supports English, Urdu, Hindi, Arabic, and 95+ more languages. Models are downloaded once and cached in your browser.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setSelectedModel("Xenova/whisper-tiny")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition ${
                  selectedModel === "Xenova/whisper-tiny"
                    ? "bg-indigo-600/20 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } disabled:opacity-50`}
              >
                <div className="text-xs font-bold">Whisper Tiny</div>
                <div className="text-[11px] text-slate-400">~40 MB • Fastest</div>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => setSelectedModel("Xenova/whisper-base")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition ${
                  selectedModel === "Xenova/whisper-base"
                    ? "bg-indigo-600/20 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } disabled:opacity-50`}
              >
                <div className="text-xs font-bold">Whisper Base</div>
                <div className="text-[11px] text-slate-400">~75 MB • Balanced</div>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => setSelectedModel("Xenova/whisper-small")}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition ${
                  selectedModel === "Xenova/whisper-small"
                    ? "bg-indigo-600/20 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } disabled:opacity-50`}
              >
                <div className="text-xs font-bold">Whisper Small</div>
                <div className="text-[11px] text-slate-400">~240 MB • Best for Urdu</div>
              </button>
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300">
              <strong className="text-white">
                For Urdu, please select Urdu from the dropdown. Auto-detect may hallucinate on small models.
              </strong>{" "}
              Using <span className="font-semibold text-white">whisper-small</span> (default) is slightly slower to load, but delivers much higher accuracy for Urdu and non-English languages.
            </p>
          </div>
        </div>

        {/* Upload Dropzone OR Selected Media Card */}
        {!mediaFile ? (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-10 md:p-14 text-center ${
              isDragActive
                ? "border-cyan-400 bg-cyan-500/10 scale-[0.995]"
                : "border-slate-700/80 hover:border-cyan-500/70 bg-slate-900/50 hover:bg-slate-900/80"
            }`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-100">
              {isDragActive
                ? "Drop your audio or video file here..."
                : "Drag & Drop an Audio or Video File"}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-xl mx-auto">
              Supports audio (<strong className="text-slate-300">MP3, WAV, M4A, OGG, FLAC</strong>) and video (<strong className="text-slate-300">MP4, MOV, WebM, MKV, AVI</strong>). Video audio tracks are automatically extracted via FFmpeg WebAssembly before transcription.
            </p>
            <div className="mt-5">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition">
                Choose Audio or Video File
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-7 space-y-6 shadow-xl">
            {/* File Summary Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`p-3 rounded-xl border shrink-0 ${
                    isVideo
                      ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                      : "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
                  }`}
                >
                  {isVideo ? (
                    <FileVideo className="w-6 h-6" />
                  ) : (
                    <FileAudio className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm md:text-base font-bold text-white truncate max-w-md">
                      {mediaFile.name}
                    </p>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isVideo
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {isVideo ? "Video • FFmpeg Audio Extract" : "Audio File"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Size: {formatBytes(mediaFile.size)} • Model:{" "}
                    <span className="text-slate-200 font-medium">
                      {selectedModel}
                    </span>{" "}
                    • Language:{" "}
                    <span className="text-cyan-300 font-medium">
                      {getLanguageLabel(selectedLanguage)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={resetFile}
                  disabled={isBusy}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Change File
                </button>

                {/* Language Selection Dropdown before Transcribe button */}
                <div className="relative flex items-center">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 absolute left-3 pointer-events-none" />
                  <select
                    aria-label="Audio language"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={isBusy}
                    className="pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-cyan-500/60 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-xs font-semibold text-slate-100 disabled:opacity-50 transition cursor-pointer"
                  >
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option
                        key={lang.code}
                        value={lang.code}
                        className="bg-slate-900 text-slate-100"
                      >
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleTranscribe}
                  disabled={isBusy}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {phase === "processing-file"
                        ? "Processing Media..."
                        : phase === "loading-model"
                        ? "Loading AI Model..."
                        : "Transcribing..."}
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Transcribe
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Red Warning Banner for Files > 200MB */}
            {isLargeFile && (
              <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs md:text-sm text-rose-300 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  For best performance, please use files smaller than 200MB. Large files may crash your browser.
                </span>
              </div>
            )}

            {selectedLanguage === "auto" && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-[11px] text-slate-400">
                <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-200">
                    For Urdu, please select Urdu from the dropdown. Auto-detect may hallucinate on small models.
                  </strong>{" "}
                  Auto-detect only inspects the first 30 seconds of audio.
                </span>
              </div>
            )}

            {/* Compact Media Preview Player */}
            {mediaPreviewUrl && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
                {isVideo ? (
                  <video
                    src={mediaPreviewUrl}
                    controls
                    className="w-full max-h-60 rounded-lg bg-black"
                  />
                ) : (
                  <audio src={mediaPreviewUrl} controls className="w-full" />
                )}
              </div>
            )}

            {/* Dual Progress Bars: File Processing + AI Model Loading */}
            {(isBusy || phase === "done") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* 1. File Processing & Transcription Progress */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      {phase === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : phase === "processing-file" ||
                        phase === "transcribing" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                      ) : (
                        <FileAudio className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      File Processing &amp; Transcription
                    </span>
                    <span className="font-mono font-bold text-cyan-300">
                      {fileProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        phase === "done"
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-cyan-500 to-indigo-500"
                      }`}
                      style={{ width: `${fileProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {fileStatusText}
                  </p>
                </div>

                {/* 2. AI Model Loading Progress */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      {modelProgress >= 100 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : phase === "loading-model" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                      ) : (
                        <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      AI Model Loading ({selectedModel.replace("Xenova/", "")})
                    </span>
                    <span className="font-mono font-bold text-purple-300">
                      {modelProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        modelProgress >= 100
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                      }`}
                      style={{ width: `${modelProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {modelStatusText}
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {phase === "error" && errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Final Transcript Output Box */}
        {(phase === "done" || transcript) && (
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Generated Transcript
                  </h3>
                  <p className="text-xs text-slate-400">
                    {wordCount} words • {formattedTranscript.length} characters
                    {detectedLanguageInfo && (
                      <>
                        {" "}
                        •{" "}
                        <span className="text-cyan-300 font-medium">
                          {detectedLanguageInfo.autoDetected
                            ? `Auto-detected: ${getLanguageLabel(detectedLanguageInfo.code)}`
                            : `Language: ${getLanguageLabel(detectedLanguageInfo.code)}`}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {chunks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIncludeTimestamps((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                      includeTimestamps
                        ? "bg-indigo-600/25 border-indigo-500 text-indigo-200"
                        : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {includeTimestamps ? "Timestamps: ON" : "Timestamps: OFF"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .TXT
                </button>

                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              aria-label="Generated transcript text"
              dir="auto"
              value={formattedTranscript}
              onChange={(e) => {
                setIncludeTimestamps(false);
                setTranscript(e.target.value);
              }}
              rows={10}
              placeholder="Your transcript will appear here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
            />
          </div>
        )}
      </div>
    </div>
  );
}
