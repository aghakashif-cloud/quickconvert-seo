"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FFmpeg, type FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Sparkles,
  Upload,
  FileVideo,
  FileAudio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Check,
  Download,
  Trash2,
  Tag,
  Hash,
  FileText,
  Image as ImageIcon,
  Wand2,
  Globe,
  Type as TypeIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type WhisperModelId = "Xenova/whisper-base" | "Xenova/whisper-small";

type PipelineStepId =
  | "extracting-audio"
  | "transcribing-content"
  | "generating-seo"
  | "creating-thumbnails";

interface SeoResult {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
}

interface ExtractedFrame {
  id: string;
  label: string;
  timestampLabel: string;
  dataUrl: string;
}

interface WorkerMessage {
  type:
    | "model-progress"
    | "model-ready"
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
  chunksProcessed?: number;
  estimatedChunks?: number;
  text?: string;
  message?: string;
}

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const THUMB_WIDTH = 1280;
const THUMB_HEIGHT = 720;

const PIPELINE_STEPS: { id: PipelineStepId; label: string }[] = [
  { id: "extracting-audio", label: "Extracting Audio" },
  { id: "transcribing-content", label: "Transcribing Content" },
  { id: "generating-seo", label: "Generating SEO" },
  { id: "creating-thumbnails", label: "Creating Thumbnails" },
];

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English (en)" },
  { code: "ur", label: "Urdu — اردو (ur)" },
  { code: "hi", label: "Hindi — हिन्दी (hi)" },
  { code: "ar", label: "Arabic — العربية (ar)" },
  { code: "es", label: "Spanish (es)" },
  { code: "fr", label: "French (fr)" },
  { code: "de", label: "German (de)" },
  { code: "pt", label: "Portuguese (pt)" },
  { code: "tr", label: "Turkish (tr)" },
];

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "wmv",
  "flv",
  "3gp",
  "webm",
]);

function getAutoSelectedModel(languageCode: string): WhisperModelId {
  return languageCode === "en" ? "Xenova/whisper-base" : "Xenova/whisper-small";
}

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
 * Parses a 16kHz Mono 16-bit signed PCM WAV (pcm_s16le) into normalized Float32Array samples.
 */
function parsePcm16MonoWav(
  arrayBuffer: ArrayBuffer
): { pcm: Float32Array; duration: number } | null {
  if (arrayBuffer.byteLength < 44) return null;
  const view = new DataView(arrayBuffer);

  const readFourCC = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

  if (readFourCC(0) !== "RIFF" || readFourCC(8) !== "WAVE") {
    return null;
  }

  let sampleRate = 16000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkId = readFourCC(offset);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt " && offset + 24 <= arrayBuffer.byteLength) {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, arrayBuffer.byteLength - dataOffset);
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (
    dataOffset < 0 ||
    dataSize <= 0 ||
    audioFormat !== 1 ||
    numChannels !== 1 ||
    bitsPerSample !== 16 ||
    sampleRate !== 16000
  ) {
    return null;
  }

  const numSamples = Math.floor(dataSize / 2);
  const pcm = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    pcm[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  }

  return { pcm, duration: numSamples / sampleRate };
}

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

    if (decoded.sampleRate !== 16000) {
      const targetLength = Math.max(1, Math.ceil(decoded.duration * 16000));
      const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start(0);
      targetBuffer = await offlineCtx.startRendering();
    }

    const pcm = new Float32Array(targetBuffer.getChannelData(0));
    return { pcm, duration: targetBuffer.duration };
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

/**
 * Generates clean studio gradient backgrounds for audio-only uploads
 * so users still get a full 1280x720 HD Thumbnail Builder experience.
 */
function createAudioFallbackFrames(): ExtractedFrame[] {
  const palettes: { id: string; label: string; colors: [string, string, string] }[] = [
    {
      id: "studio-indigo",
      label: "Studio Indigo",
      colors: ["#0f172a", "#312e81", "#020617"],
    },
    {
      id: "creator-crimson",
      label: "Creator Crimson",
      colors: ["#1f1024", "#881337", "#090d16"],
    },
    {
      id: "cyber-teal",
      label: "Cyber Teal",
      colors: ["#042f2e", "#155e75", "#020617"],
    },
  ];

  return palettes.map((palette) => {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      grad.addColorStop(0, palette.colors[0]);
      grad.addColorStop(0.55, palette.colors[1]);
      grad.addColorStop(1, palette.colors[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

      // Subtle glowing accent orb
      const radial = ctx.createRadialGradient(
        THUMB_WIDTH * 0.72,
        THUMB_HEIGHT * 0.28,
        20,
        THUMB_WIDTH * 0.72,
        THUMB_HEIGHT * 0.28,
        420
      );
      radial.addColorStop(0, "rgba(255, 255, 255, 0.16)");
      radial.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    }

    return {
      id: palette.id,
      label: palette.label,
      timestampLabel: "Audio BG",
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    };
  });
}

/**
 * Extracts frames at 25%, 50%, 75%, and 90% of a video using HTML5 <video> and <canvas>.
 */
async function extractVideoFrames(file: File): Promise<ExtractedFrame[]> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out loading video metadata for thumbnails.")),
        12000
      );
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Browser could not decode video frames for thumbnails."));
      };
    });

    const duration =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const points = [
      { pct: 0.25, label: "25%" },
      { pct: 0.5, label: "50%" },
      { pct: 0.75, label: "75%" },
      { pct: 0.9, label: "90%" },
    ];

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return createAudioFallbackFrames();

    const frames: ExtractedFrame[] = [];

    for (const point of points) {
      const targetTime = Math.min(
        Math.max(0.05, duration * point.pct),
        Math.max(0.05, duration - 0.1)
      );

      await new Promise<void>((resolve) => {
        const seekTimeout = setTimeout(() => resolve(), 4000);
        const onSeeked = () => {
          clearTimeout(seekTimeout);
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        try {
          video.currentTime = targetTime;
        } catch {
          clearTimeout(seekTimeout);
          resolve();
        }
      });

      // Draw frame covering 1280x720 without distortion (center-crop object-cover)
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

      const vw = video.videoWidth || THUMB_WIDTH;
      const vh = video.videoHeight || THUMB_HEIGHT;
      const videoAspect = vw / vh;
      const canvasAspect = THUMB_WIDTH / THUMB_HEIGHT;

      let drawW = THUMB_WIDTH;
      let drawH = THUMB_HEIGHT;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspect > canvasAspect) {
        drawH = THUMB_HEIGHT;
        drawW = drawH * videoAspect;
        offsetX = (THUMB_WIDTH - drawW) / 2;
      } else {
        drawW = THUMB_WIDTH;
        drawH = drawW / videoAspect;
        offsetY = (THUMB_HEIGHT - drawH) / 2;
      }

      ctx.drawImage(video, offsetX, offsetY, drawW, drawH);

      frames.push({
        id: `frame-${point.label}`,
        label: `Frame ${point.label}`,
        timestampLabel: formatTimestamp(targetTime),
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      });
    }

    return frames.length > 0 ? frames : createAudioFallbackFrames();
  } catch {
    return createAudioFallbackFrames();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Wraps text into lines that fit within maxWidth on a Canvas 2D context.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(i).join(" ");
        let trimmed = remaining;
        while (
          trimmed.length > 3 &&
          ctx.measureText(`${trimmed}...`).width > maxWidth
        ) {
          trimmed = trimmed.slice(0, -1).trimEnd();
        }
        lines.push(
          trimmed.length < remaining.length ? `${trimmed}...` : trimmed
        );
        return lines;
      }
    }
  }

  lines.push(currentLine);
  return lines.slice(0, maxLines);
}

export default function VideoToSeoPage() {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // Pipeline state
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [currentStep, setCurrentStep] = useState<PipelineStepId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<PipelineStepId[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Upload a short video or audio clip to generate YouTube SEO & an HD thumbnail."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Outputs
  const [transcript, setTranscript] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [thumbnailText, setThumbnailText] = useState<string>("");

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Refs
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef<boolean>(false);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseFFmpegMemory = useCallback(() => {
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.terminate();
      } catch {
        // ignore termination error
      }
      ffmpegRef.current = null;
      ffmpegLoadedRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      releaseFFmpegMemory();
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, [releaseFFmpegMemory]);

  const selectedFrame =
    frames.find((f) => f.id === selectedFrameId) || frames[0] || null;

  // Redraw the 1280x720 HD Thumbnail Canvas whenever the selected frame or thumbnail text changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedFrame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

      ctx.clearRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      ctx.drawImage(img, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

      // Dark bottom gradient overlay for crisp text legibility
      const gradient = ctx.createLinearGradient(
        0,
        THUMB_HEIGHT * 0.36,
        0,
        THUMB_HEIGHT
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.55)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.92)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, THUMB_HEIGHT * 0.36, THUMB_WIDTH, THUMB_HEIGHT * 0.64);

      const cleanText = thumbnailText.trim();
      if (cleanText) {
        const fontSize =
          cleanText.length <= 28 ? 82 : cleanText.length <= 45 ? 70 : 60;
        const lineHeight = Math.round(fontSize * 1.18);
        const horizontalPadding = 68;
        const maxTextWidth = THUMB_WIDTH - horizontalPadding * 2;

        ctx.font = `900 ${fontSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        const lines = wrapCanvasText(ctx, cleanText, maxTextWidth, 3);
        const bottomMargin = 54;
        const startY =
          THUMB_HEIGHT - bottomMargin - (lines.length - 1) * lineHeight;

        lines.forEach((line, idx) => {
          const y = startY + idx * lineHeight;

          // Strong black drop shadow + dark outline
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6;
          ctx.lineWidth = 8;
          ctx.lineJoin = "round";
          ctx.strokeStyle = "rgba(0, 0, 0, 0.88)";
          ctx.strokeText(line, THUMB_WIDTH / 2, y);

          // Bold white foreground text
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(line, THUMB_WIDTH / 2, y);
          ctx.restore();
        });
      }
    };
    img.src = selectedFrame.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [selectedFrame, thumbnailText]);

  const extractWavViaFFmpeg = async (file: File): Promise<ArrayBuffer> => {
    setStatusMessage("Loading FFmpeg WebAssembly engine to extract audio...");
    setOverallProgress(5);

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on("progress", ({ progress }) => {
      const clamped = Math.min(1, Math.max(0, progress));
      setOverallProgress(Math.round(8 + clamped * 16));
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegLoadedRef.current = true;

    const mountDir = "/input_mount";
    const outputName = "extracted_16k_mono.wav";
    let inputPath = "";
    let usedWorkerFS = false;

    try {
      try {
        await ffmpeg.createDir(mountDir);
        await ffmpeg.mount("WORKERFS" as FFFSType, { files: [file] }, mountDir);
        inputPath = `${mountDir}/${file.name}`;
        usedWorkerFS = true;
      } catch {
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
        inputPath = `input_media.${ext}`;
        await ffmpeg.writeFile(inputPath, await fetchFile(file));
      }

      setStatusMessage("Extracting 16kHz Mono WAV audio track via FFmpeg...");

      const exitCode = await ffmpeg.exec([
        "-i",
        inputPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        outputName,
      ]);

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg failed to extract audio (exit code ${exitCode}). Ensure your file contains an audio track.`
        );
      }

      const data = await ffmpeg.readFile(outputName);
      const uint8 =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      return uint8.slice().buffer;
    } finally {
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

  const transcribeWithWhisperWorker = (
    pcm: Float32Array,
    durationSeconds: number,
    language: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../ai-transcriber/whisper.worker.ts", import.meta.url),
          { type: "module" }
        );
      }

      const worker = workerRef.current;
      const modelId = getAutoSelectedModel(language);

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === "model-progress") {
          const pct = Math.min(99, Math.round(msg.progress ?? 0));
          setOverallProgress(Math.round(28 + pct * 0.14));
          setStatusMessage(
            `Loading Whisper AI model (${pct}%) — cached in browser after first run...`
          );
        } else if (msg.type === "model-ready") {
          setOverallProgress(44);
          setStatusMessage("Whisper AI model ready. Transcribing speech...");
        } else if (msg.type === "transcribe-progress") {
          const subPct = msg.progress ?? 0;
          setOverallProgress(Math.min(68, Math.round(45 + subPct * 0.23)));
          setStatusMessage(
            `Transcribing content locally (chunk ${msg.chunksProcessed ?? 0}/${
              msg.estimatedChunks ?? 1
            })...`
          );
        } else if (msg.type === "complete") {
          resolve((msg.text || "").trim());
        } else if (msg.type === "error") {
          reject(
            new Error(
              msg.message || "Whisper AI failed to transcribe the audio track."
            )
          );
        }
      };

      worker.onerror = (err) => {
        reject(
          new Error(
            err.message ||
              "Web Worker encountered an error while running Whisper AI."
          )
        );
      };

      worker.postMessage(
        {
          type: "transcribe",
          audio: pcm,
          model: modelId,
          language,
          durationSeconds,
        },
        [pcm.buffer]
      );
    });
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const firstErr = rejections[0].errors[0];
        if (firstErr?.code === "file-too-large") {
          setErrorMessage(
            "File exceeds the 100 MB limit. Please upload a shorter video under 100 MB (ideally under 2 minutes)."
          );
          setStatus("error");
          return;
        }
        setErrorMessage(
          firstErr?.message || "Unsupported file type. Please upload a video or audio file."
        );
        setStatus("error");
        return;
      }

      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(
          "File exceeds the 100 MB limit. Please upload a shorter video under 100 MB."
        );
        setStatus("error");
        return;
      }

      setMediaFile(file);
      setIsVideo(isVideoFile(file));
      setStatus("idle");
      setCurrentStep(null);
      setCompletedSteps([]);
      setOverallProgress(0);
      setErrorMessage(null);
      setTranscript("");
      setSeoResult(null);
      setFrames([]);
      setSelectedFrameId(null);
      setThumbnailText("");
      setStatusMessage(
        `Ready to analyze "${file.name}" (${formatBytes(file.size)}). Click Generate SEO & Thumbnails to begin.`
      );
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: MAX_FILE_SIZE_BYTES,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"],
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"],
    },
  });

  const handleGenerateAll = async () => {
    if (!mediaFile || status === "running") return;

    setStatus("running");
    setErrorMessage(null);
    setSeoResult(null);
    setTranscript("");
    setFrames([]);
    setSelectedFrameId(null);
    setThumbnailText("");
    setCompletedSteps([]);

    try {
      // STEP 1: Extracting Audio (FFmpeg 16kHz Mono WAV)
      setCurrentStep("extracting-audio");
      setOverallProgress(4);
      setStatusMessage("Extracting 16kHz Mono WAV audio track via FFmpeg WASM...");

      let wavBuffer = await extractWavViaFFmpeg(mediaFile);
      let decodedAudio = parsePcm16MonoWav(wavBuffer);
      if (!decodedAudio) {
        decodedAudio = await decodeAudioTo16kHzMono(wavBuffer);
      }
      wavBuffer = new ArrayBuffer(0);

      setCompletedSteps(["extracting-audio"]);
      setOverallProgress(26);

      // STEP 2: Transcribing Content (Whisper AI in Web Worker)
      setCurrentStep("transcribing-content");
      setStatusMessage("Loading Whisper AI & transcribing audio locally...");

      const transcriptText = await transcribeWithWhisperWorker(
        decodedAudio.pcm,
        decodedAudio.duration,
        selectedLanguage
      );

      if (!transcriptText || transcriptText.trim().length < 5) {
        throw new Error(
          "No clear speech was detected in this video/audio clip. Please try a clip with clearer spoken audio or select the matching spoken language."
        );
      }

      setTranscript(transcriptText);
      setCompletedSteps(["extracting-audio", "transcribing-content"]);
      setOverallProgress(70);

      // STEP 3: Generating SEO (Gemini AI API)
      setCurrentStep("generating-seo");
      setStatusMessage("Generating high-CTR Title, Description, Hashtags & Tags with Gemini AI...");

      const seoRes = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });

      const seoData = await seoRes.json();
      if (!seoRes.ok) {
        throw new Error(
          seoData?.error || "Gemini AI failed to generate YouTube SEO metadata."
        );
      }

      const finalSeo: SeoResult = {
        title: seoData.title || "",
        description: seoData.description || "",
        tags: Array.isArray(seoData.tags) ? seoData.tags : [],
        hashtags: Array.isArray(seoData.hashtags) ? seoData.hashtags : [],
      };

      setSeoResult(finalSeo);
      setThumbnailText(finalSeo.title);
      setCompletedSteps([
        "extracting-audio",
        "transcribing-content",
        "generating-seo",
      ]);
      setOverallProgress(86);

      // STEP 4: Creating Thumbnails (HTML5 <video> + <canvas> at 25%, 50%, 75%, 90%)
      setCurrentStep("creating-thumbnails");
      setStatusMessage("Extracting HD frames at 25%, 50%, 75%, and 90%...");

      const extractedFrames = isVideo
        ? await extractVideoFrames(mediaFile)
        : createAudioFallbackFrames();

      setFrames(extractedFrames);
      if (extractedFrames.length > 0) {
        setSelectedFrameId(extractedFrames[0].id);
      }

      setCompletedSteps([
        "extracting-audio",
        "transcribing-content",
        "generating-seo",
        "creating-thumbnails",
      ]);
      setCurrentStep(null);
      setOverallProgress(100);
      setStatusMessage("All done! Your SEO metadata and HD Thumbnail Studio are ready.");
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setCurrentStep(null);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while processing your video."
      );
    }
  };

  const resetAll = () => {
    setMediaFile(null);
    setStatus("idle");
    setCurrentStep(null);
    setCompletedSteps([]);
    setOverallProgress(0);
    setErrorMessage(null);
    setTranscript("");
    setSeoResult(null);
    setFrames([]);
    setSelectedFrameId(null);
    setThumbnailText("");
    setStatusMessage(
      "Upload a short video or audio clip to generate YouTube SEO & an HD thumbnail."
    );
  };

  const copyToClipboard = async (text: string, fieldKey: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadThumbnail = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const baseName = mediaFile
      ? mediaFile.name.replace(/\.[^/.]+$/, "")
      : "youtube";
    const link = document.createElement("a");
    link.download = `${baseName}-hd-thumbnail-1280x720.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRunning = status === "running";
  const titleCharCount = seoResult?.title.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-rose-400" />
              Whisper AI + Gemini AI + HD Thumbnail Studio
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Video-to-SEO Generator
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Upload a short video to automatically transcribe its audio locally, generate a high-CTR YouTube Title, Description, Hashtags &amp; Tags with Gemini AI, and build a custom 1280×720 HD thumbnail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/ai-transcriber"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              AI Transcriber
            </Link>
            <Link
              href="/tools/youtube-seo-audit"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              YouTube SEO Audit
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

        {/* Required Warning Banner + Privacy Note */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-200">
              For best results, please upload videos under 2 minutes. Large videos may crash the browser.
            </p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-emerald-300">
              Video decoding, frame extraction &amp; Whisper transcription run locally in your browser—only the text transcript is sent to Gemini AI.
            </p>
          </div>
        </div>

        {/* Upload Dropzone OR Selected File Workspace */}
        {!mediaFile ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-10 md:p-14 text-center ${
                isDragActive
                  ? "border-indigo-400 bg-indigo-500/10 scale-[0.995]"
                  : "border-slate-700/80 hover:border-indigo-500/70 bg-slate-900/50 hover:bg-slate-900/80"
              }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-rose-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-100">
                {isDragActive
                  ? "Drop your short video or audio file here..."
                  : "Drag & Drop a Video or Audio File (Max 100 MB)"}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-xl mx-auto">
                Supports <strong className="text-slate-300">MP4, MOV, WebM, MKV, AVI</strong> videos and <strong className="text-slate-300">MP3, WAV, M4A</strong> audio files up to 100 MB.
              </p>
              <div className="mt-5">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition">
                  Choose Video / Audio File
                </span>
              </div>
            </div>

            {status === "error" && errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {/* Selected File Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl border bg-indigo-500/10 border-indigo-500/25 text-indigo-400 shrink-0">
                  {isVideo ? (
                    <FileVideo className="w-6 h-6" />
                  ) : (
                    <FileAudio className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-bold text-white truncate max-w-md">
                    {mediaFile.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(mediaFile.size)} •{" "}
                    {isVideo ? "Video (SEO + Frame Thumbnails)" : "Audio File (SEO + Gradient Thumbnail)"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isRunning}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Change File
                </button>

                {/* Spoken Language Selector */}
                <div className="relative flex items-center">
                  <Globe className="w-3.5 h-3.5 text-indigo-400 absolute left-3 pointer-events-none" />
                  <select
                    aria-label="Spoken language in video"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={isRunning}
                    className="pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-indigo-500/60 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-slate-100 disabled:opacity-50 cursor-pointer"
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
                  onClick={handleGenerateAll}
                  disabled={isRunning}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate SEO &amp; Thumbnails
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 4-Step Pipeline Progress Bar */}
            {(isRunning || status === "done") && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    {status === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    )}
                    <span>{statusMessage}</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-300 shrink-0">
                    {overallProgress}%
                  </span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === "done"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PIPELINE_STEPS.map((step, index) => {
                    const isDone = completedSteps.includes(step.id);
                    const isActive = currentStep === step.id;
                    return (
                      <div
                        key={step.id}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition ${
                          isDone
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : isActive
                            ? "bg-indigo-500/15 border-indigo-500/50 text-white"
                            : "bg-slate-900/70 border-slate-800 text-slate-500"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-700 text-[10px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                        )}
                        <span className="truncate">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Alert */}
            {status === "error" && errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* SEO Metadata Output Boxes */}
        {seoResult && (
          <div className="space-y-5">
            {/* Title Box */}
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm md:text-base font-bold text-white">
                    Optimized YouTube Title
                  </h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      titleCharCount <= 60
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {titleCharCount} / 60 chars
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(seoResult.title, "title")}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  {copiedField === "title" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Title
                    </>
                  )}
                </button>
              </div>

              <div
                dir="auto"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm md:text-base font-bold text-white"
              >
                {seoResult.title}
              </div>
            </div>

            {/* Description Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm md:text-base font-bold text-white">
                    SEO Description &amp; Hashtags
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(seoResult.description, "description")
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  {copiedField === "description" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Description
                    </>
                  )}
                </button>
              </div>

              <textarea
                aria-label="Generated YouTube description"
                dir="auto"
                readOnly
                value={seoResult.description}
                rows={7}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs md:text-sm text-slate-200 leading-relaxed focus:outline-none resize-y"
              />

              {seoResult.hashtags.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 mr-1" />
                    {seoResult.hashtags.map((tag, idx) => (
                      <span
                        key={`${tag}-${idx}`}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(seoResult.hashtags.join(" "), "hashtags")
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 shrink-0"
                  >
                    {copiedField === "hashtags" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Hashtags
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Tags Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm md:text-base font-bold text-white">
                    SEO Tags ({seoResult.tags.length})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(seoResult.tags.join(", "), "tags")
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                >
                  {copiedField === "tags" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied All Tags!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy All Tags
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-2">
                {seoResult.tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Optional Collapsible Transcript Box */}
            {transcript && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <button
                  type="button"
                  onClick={() => setShowTranscript((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    View Extracted Whisper Transcript ({transcript.split(/\s+/).length} words)
                  </span>
                  {showTranscript ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {showTranscript && (
                  <p
                    dir="auto"
                    className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap"
                  >
                    {transcript}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom HD Thumbnail Studio Section */}
        {frames.length > 0 && (
          <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Custom HD Thumbnail Studio (1280×720)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pick a frame from your video, customize the bold overlay text, and download a ready-to-upload YouTube HD thumbnail.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadThumbnail}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-rose-600/20 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download HD Thumbnail
              </button>
            </div>

            {/* Frame Picker Strip (25%, 50%, 75%, 90%) */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Extracted Frame
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {frames.map((frame) => {
                  const isSelected = selectedFrame?.id === frame.id;
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setSelectedFrameId(frame.id)}
                      className={`group relative rounded-xl overflow-hidden border-2 text-left transition ${
                        isSelected
                          ? "border-rose-500 ring-2 ring-rose-500/40"
                          : "border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={frame.dataUrl}
                        alt={frame.label}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="px-2.5 py-1.5 bg-slate-950/90 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-200">
                          {frame.label}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {frame.timestampLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thumbnail Text Input */}
            <div className="space-y-2">
              <label
                htmlFor="thumbnail-text-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                <TypeIcon className="w-3.5 h-3.5 text-rose-400" />
                Thumbnail Text (Bold White Overlay)
              </label>
              <input
                id="thumbnail-text-input"
                type="text"
                value={thumbnailText}
                onChange={(e) => setThumbnailText(e.target.value)}
                placeholder="Enter bold text to display on your thumbnail..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-rose-500/60 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-sm font-semibold text-white placeholder:text-slate-500 transition"
              />
            </div>

            {/* Live 1280x720 Canvas Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Live HD Preview</span>
                <span className="font-mono text-slate-300">1280 × 720 px</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
                <canvas
                  ref={canvasRef}
                  width={THUMB_WIDTH}
                  height={THUMB_HEIGHT}
                  className="w-full h-auto block aspect-video"
                />
              </div>
            </div>
          </div>
        )}

        <ToolSeoContent
          toolName="Video-to-SEO Generator"
          aboutParagraphs={[
            "The Video-to-SEO Generator turns a raw short video clip into a complete, publish-ready YouTube optimization package in one automated workflow. Instead of manually writing titles, descriptions, hashtags, and tags from scratch, this tool extracts your video's audio track locally with FFmpeg WebAssembly, transcribes the spoken script using Whisper AI in your browser, and sends only the resulting text transcript to Google Gemini AI to generate high-CTR YouTube SEO metadata.",
            "Alongside your SEO metadata, the built-in HD Thumbnail Studio captures crisp video frames at 25%, 50%, 75%, and 90% of your clip using the HTML5 Video and Canvas APIs. You can pick the best visual frame, customize the bold white overlay headline pre-filled from your generated SEO title, and download a ready-to-upload 1280x720 HD PNG thumbnail without opening Photoshop or Canva.",
          ]}
          howToSteps={[
            {
              title: "Upload a Short Video or Audio Clip",
              detail:
                "Drag and drop an MP4, MOV, WebM, or audio file under 100 MB (ideally under 2 minutes for fastest browser processing).",
            },
            {
              title: "Pick Spoken Language & Generate",
              detail:
                "Select the spoken language in your clip and click Generate SEO & Thumbnails to run the 4-step extraction, transcription, SEO, and frame pipeline.",
            },
            {
              title: "Copy Metadata & Download HD Thumbnail",
              detail:
                "Copy your under-60-character title, description, hashtags, and 15-20 SEO tags, then select a video frame and export your custom 1280x720 PNG thumbnail.",
            },
          ]}
          highlights={[
            "All-in-one creator workflow combining FFmpeg WASM, Whisper AI transcription, Gemini SEO generation, and a 1280x720 Canvas thumbnail builder.",
            "Generates strict under-60-character high-CTR YouTube titles, structured descriptions, hashtags, and 15-20 keyword tags.",
            "Extracts multiple key video frames locally and overlays a dark readability gradient with bold white shadowed text.",
            "Privacy-first architecture: raw video files remain strictly inside your browser and are never uploaded to our server.",
          ]}
        />
      </div>
    </div>
  );
}
