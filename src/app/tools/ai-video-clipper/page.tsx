"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone } from "react-dropzone";
import { FFmpeg, type FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Scissors,
  Upload,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  FileText,
  Trash2,
  Video,
  Globe,
  SlidersHorizontal,
  RefreshCw,
  Wand2,
  BookOpen,
} from "lucide-react";

type WhisperModelId = "Xenova/whisper-base" | "Xenova/whisper-small";
type StageId = "transcribing" | "analyzing" | "rendering";
type SensitivityMode = "gentle" | "balanced" | "aggressive";

interface TranscriptChunk {
  timestamp: [number, number | null];
  text: string;
}

interface CutRange {
  id: string;
  start: number;
  end: number;
  reason: string;
  enabled: boolean;
}

interface KeepSegment {
  start: number;
  end: number;
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
  chunksProcessed?: number;
  estimatedChunks?: number;
  text?: string;
  chunks?: TranscriptChunk[];
  message?: string;
}

const PIPELINE_STAGES: { id: StageId; label: string }[] = [
  { id: "transcribing", label: "Transcribing Audio" },
  { id: "analyzing", label: "Analyzing for Cuts" },
  { id: "rendering", label: "Rendering Final Video" },
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

const SENSITIVITY_CONFIG: Record<
  SensitivityMode,
  { label: string; desc: string; rmsThreshold: number; minSilenceSec: number; padSec: number }
> = {
  gentle: {
    label: "Gentle",
    desc: "Only cuts long pauses (>= 1.1s)",
    rmsThreshold: 0.012,
    minSilenceSec: 1.1,
    padSec: 0.16,
  },
  balanced: {
    label: "Balanced",
    desc: "Recommended for vlogs & podcasts (>= 0.65s)",
    rmsThreshold: 0.016,
    minSilenceSec: 0.65,
    padSec: 0.12,
  },
  aggressive: {
    label: "Tight Cuts",
    desc: "Fast YouTube pace (>= 0.45s pauses)",
    rmsThreshold: 0.022,
    minSilenceSec: 0.45,
    padSec: 0.08,
  },
};

const FILLER_WORD_REGEX =
  /\b(um+|uh+|ah+|er+|erm+|hmm+|hm+|mm+|you know)\b/gi;

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

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem < 10 ? "0" : ""}${rem.toFixed(1)}`;
}

/**
 * Parses a 16kHz Mono 16-bit signed PCM WAV into Float32Array samples.
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

  if (readFourCC(0) !== "RIFF" || readFourCC(8) !== "WAVE") return null;

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

/**
 * Fallback decoder using Web Audio API if WAV parsing fails.
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
 * Scans 16kHz mono PCM audio for sustained acoustic silence gaps using RMS energy.
 */
function detectAcousticSilences(
  pcm: Float32Array,
  sampleRate: number,
  rmsThreshold: number,
  minSilenceSec: number,
  padSec: number
): Array<{ start: number; end: number }> {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const totalWindows = Math.floor(pcm.length / windowSize);
  const silences: Array<{ start: number; end: number }> = [];

  let silentStartIdx: number | null = null;

  for (let w = 0; w < totalWindows; w++) {
    let sumSq = 0;
    const base = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const sample = pcm[base + i];
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / windowSize);

    if (rms < rmsThreshold) {
      if (silentStartIdx === null) silentStartIdx = w;
    } else if (silentStartIdx !== null) {
      const rawStart = silentStartIdx * 0.05;
      const rawEnd = w * 0.05;
      if (rawEnd - rawStart >= minSilenceSec) {
        const paddedStart = rawStart === 0 ? 0 : rawStart + padSec;
        const paddedEnd = rawEnd - padSec;
        if (paddedEnd - paddedStart >= 0.25) {
          silences.push({
            start: Number(paddedStart.toFixed(2)),
            end: Number(paddedEnd.toFixed(2)),
          });
        }
      }
      silentStartIdx = null;
    }
  }

  // Trailing silence at the very end of the video
  if (silentStartIdx !== null) {
    const rawStart = silentStartIdx * 0.05;
    const rawEnd = pcm.length / sampleRate;
    if (rawEnd - rawStart >= minSilenceSec) {
      const paddedStart = rawStart + padSec;
      if (rawEnd - paddedStart >= 0.25) {
        silences.push({
          start: Number(paddedStart.toFixed(2)),
          end: Number(rawEnd.toFixed(2)),
        });
      }
    }
  }

  return silences;
}

/**
 * Computes the kept ("good") video ranges by inverting sorted removal cuts.
 */
function computeKeepSegments(
  cuts: CutRange[],
  totalDuration: number
): KeepSegment[] {
  const active = cuts
    .filter((c) => c.enabled && c.end > c.start)
    .sort((a, b) => a.start - b.start);

  if (active.length === 0) {
    return [{ start: 0, end: totalDuration }];
  }

  // Merge any overlapping active cuts first
  const merged: Array<{ start: number; end: number }> = [
    { start: active[0].start, end: active[0].end },
  ];
  for (let i = 1; i < active.length; i++) {
    const prev = merged[merged.length - 1];
    if (active[i].start <= prev.end + 0.08) {
      prev.end = Math.max(prev.end, active[i].end);
    } else {
      merged.push({ start: active[i].start, end: active[i].end });
    }
  }

  const keeps: KeepSegment[] = [];
  let cursor = 0;

  for (const cut of merged) {
    if (cut.start - cursor >= 0.2) {
      keeps.push({
        start: Number(cursor.toFixed(3)),
        end: Number(cut.start.toFixed(3)),
      });
    }
    cursor = Math.max(cursor, cut.end);
  }

  if (totalDuration - cursor >= 0.2) {
    keeps.push({
      start: Number(cursor.toFixed(3)),
      end: Number(totalDuration.toFixed(3)),
    });
  }

  return keeps;
}

/**
 * Renders text with filler words ("um", "uh", "ah", etc.) highlighted in red.
 */
function renderHighlightedFillers(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(FILLER_WORD_REGEX.source, "gi");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`t-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      );
    }
    parts.push(
      <span
        key={`f-${match.index}`}
        title="Filler word flagged by AI"
        className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold line-through decoration-rose-400"
      >
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <React.Fragment key={`t-end`}>{text.slice(lastIndex)}</React.Fragment>
    );
  }

  return parts.length > 0 ? parts : text;
}

function countFillerWords(text: string): number {
  const matches = text.match(new RegExp(FILLER_WORD_REGEX.source, "gi"));
  return matches ? matches.length : 0;
}

export default function SmartJumpCutEditorPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [sensitivity, setSensitivity] = useState<SensitivityMode>("balanced");

  // Pipeline progress state
  const [pipelineStatus, setPipelineStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [currentStage, setCurrentStage] = useState<StageId | null>(null);
  const [completedStages, setCompletedStages] = useState<StageId[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Upload a talking-head video to automatically cut silences and filler words."
  );
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>(
    []
  );
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [cuts, setCuts] = useState<CutRange[]>([]);
  const [smoothVideoUrl, setSmoothVideoUrl] = useState<string | null>(null);
  const [smoothVideoSize, setSmoothVideoSize] = useState<number>(0);
  const [smoothDuration, setSmoothDuration] = useState<number>(0);
  const [reRendering, setReRendering] = useState<boolean>(false);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const releaseFFmpeg = useCallback(() => {
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.terminate();
      } catch {
        // ignore termination error
      }
      ffmpegRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      releaseFFmpeg();
    };
  }, [releaseFFmpeg]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (smoothVideoUrl) URL.revokeObjectURL(smoothVideoUrl);
    };
  }, [smoothVideoUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (smoothVideoUrl) URL.revokeObjectURL(smoothVideoUrl);

      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setVideoDuration(0);
      setSmoothVideoUrl(null);
      setSmoothVideoSize(0);
      setSmoothDuration(0);
      setTranscriptChunks([]);
      setFullTranscript("");
      setCuts([]);
      setPipelineStatus("idle");
      setCurrentStage(null);
      setCompletedStages([]);
      setOverallProgress(0);
      setError(null);
      setStatusMessage(
        "Video loaded locally. Click Auto-Edit & Remove Silences to begin."
      );
    },
    [videoPreviewUrl, smoothVideoUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: pipelineStatus === "running" || reRendering,
    accept: {
      "video/*": [".mp4", ".mov", ".webm", ".mkv", ".avi"],
    },
  });

  const loadFreshFFmpeg = async (): Promise<FFmpeg> => {
    releaseFFmpeg();
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  };

  /**
   * Step 1A: Extract 16kHz mono PCM WAV audio locally via FFmpeg.wasm.
   */
  const extract16kWav = async (file: File): Promise<ArrayBuffer> => {
    setStatusMessage("Loading FFmpeg WebAssembly engine to extract audio...");
    setOverallProgress(5);

    const ffmpeg = await loadFreshFFmpeg();
    const mountDir = "/input_mount";
    const outputWav = "audio_16k_mono.wav";
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
        inputPath = `source_in.${ext}`;
        await ffmpeg.writeFile(inputPath, await fetchFile(file));
      }

      setStatusMessage("Extracting 16kHz mono audio track via FFmpeg WASM...");
      setOverallProgress(12);

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
        outputWav,
      ]);

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg failed to extract audio (exit code ${exitCode}). Ensure your video contains an audio track.`
        );
      }

      const data = await ffmpeg.readFile(outputWav);
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
        await ffmpeg.deleteFile(outputWav);
      } catch {
        // ignore virtual FS cleanup errors
      }
      releaseFFmpeg();
    }
  };

  /**
   * Step 1B: Run local Whisper AI inside Web Worker to get timestamped chunks.
   */
  const transcribeAudioWithWhisper = (
    pcm: Float32Array,
    durationSec: number,
    language: string
  ): Promise<{ text: string; chunks: TranscriptChunk[] }> => {
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
          setOverallProgress(Math.round(16 + pct * 0.1));
          setStatusMessage(
            `Loading Whisper AI model (${pct}%) — cached in browser after first run...`
          );
        } else if (msg.type === "model-ready") {
          setOverallProgress(28);
          setStatusMessage(
            "Whisper AI loaded. Transcribing speech with timestamps locally..."
          );
        } else if (msg.type === "transcribe-progress") {
          const subPct = msg.progress ?? 0;
          setOverallProgress(Math.min(46, Math.round(28 + subPct * 0.18)));
          setStatusMessage(
            `Transcribing audio locally (chunk ${msg.chunksProcessed ?? 0}/${
              msg.estimatedChunks ?? 1
            })...`
          );
        } else if (msg.type === "complete") {
          resolve({
            text: (msg.text || "").trim(),
            chunks: Array.isArray(msg.chunks) ? msg.chunks : [],
          });
        } else if (msg.type === "error") {
          reject(
            new Error(
              msg.message || "Whisper AI failed to transcribe the video audio."
            )
          );
        }
      };

      worker.onerror = (err) => {
        reject(
          new Error(
            err.message ||
              "Web Worker encountered an error during Whisper AI transcription."
          )
        );
      };

      worker.postMessage(
        {
          type: "transcribe",
          audio: pcm,
          model: modelId,
          language,
          durationSeconds: durationSec,
        },
        [pcm.buffer]
      );
    });
  };

  /**
   * Step 3: Extract good segments via FFmpeg -ss and -to, apply subtle 30ms audio micro-fades,
   * and concatenate seamlessly into one smooth MP4.
   */
  const renderSmoothVideo = async (
    file: File,
    activeCuts: CutRange[],
    totalDur: number
  ) => {
    const keepSegments = computeKeepSegments(activeCuts, totalDur);
    const keptDuration = keepSegments.reduce(
      (sum, seg) => sum + (seg.end - seg.start),
      0
    );

    // If nothing needs removing, serve the clean source file directly without needless re-encoding
    const enabledCount = activeCuts.filter((c) => c.enabled).length;
    if (enabledCount === 0 || keepSegments.length === 0) {
      const directUrl = URL.createObjectURL(file);
      if (smoothVideoUrl) URL.revokeObjectURL(smoothVideoUrl);
      setSmoothVideoUrl(directUrl);
      setSmoothVideoSize(file.size);
      setSmoothDuration(totalDur);
      setOverallProgress(100);
      setStatusMessage(
        "No cuts applied — your video already has tight pacing! Try 'Tight Cuts' sensitivity if you want shorter pauses removed."
      );
      return;
    }

    setStatusMessage(
      `Rendering ${keepSegments.length} clean video segments via FFmpeg WASM...`
    );
    setOverallProgress(68);

    const ffmpeg = await loadFreshFFmpeg();
    const mountDir = "/render_mount";
    let inputPath = "";
    let usedWorkerFS = false;
    const segmentFiles: string[] = [];
    const outputFile = "smooth_jumpcut_output.mp4";

    try {
      try {
        await ffmpeg.createDir(mountDir);
        await ffmpeg.mount("WORKERFS" as FFFSType, { files: [file] }, mountDir);
        inputPath = `${mountDir}/${file.name}`;
        usedWorkerFS = true;
      } catch {
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
        inputPath = `render_src.${ext}`;
        await ffmpeg.writeFile(inputPath, await fetchFile(file));
      }

      for (let i = 0; i < keepSegments.length; i++) {
        const seg = keepSegments[i];
        const segDur = Math.max(0.1, seg.end - seg.start);
        const segName = `seg_${i}.mp4`;

        setStatusMessage(
          `Extracting smooth segment ${i + 1} of ${keepSegments.length} (${formatSeconds(
            seg.start
          )} – ${formatSeconds(seg.end)})...`
        );
        setOverallProgress(
          Math.min(92, Math.round(70 + (i / keepSegments.length) * 22))
        );

        const args = [
          "-ss",
          seg.start.toFixed(3),
          "-to",
          seg.end.toFixed(3),
          "-i",
          inputPath,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
        ];

        // Add subtle 30ms audio fade-in/fade-out on each jump cut to eliminate clicks/pops
        if (segDur >= 0.14) {
          const fadeOutStart = Math.max(0.03, segDur - 0.03).toFixed(3);
          args.push(
            "-af",
            `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart}:d=0.03`
          );
        }

        args.push(
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-avoid_negative_ts",
          "make_zero",
          "-movflags",
          "+faststart",
          segName
        );

        const exitCode = await ffmpeg.exec(args);
        if (exitCode !== 0) {
          throw new Error(
            `FFmpeg segment extraction failed on segment #${i + 1} (exit code ${exitCode}).`
          );
        }
        segmentFiles.push(segName);
      }

      let finalBytes: Uint8Array;

      if (segmentFiles.length === 1) {
        const data = await ffmpeg.readFile(segmentFiles[0]);
        finalBytes =
          data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data));
      } else {
        setStatusMessage(
          `Merging ${segmentFiles.length} clean segments into one smooth MP4...`
        );
        setOverallProgress(95);

        const concatListContent = segmentFiles
          .map((name) => `file '${name}'`)
          .join("\n");
        await ffmpeg.writeFile("concat_list.txt", concatListContent);

        const concatCode = await ffmpeg.exec([
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat_list.txt",
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outputFile,
        ]);

        if (concatCode !== 0) {
          throw new Error(
            `FFmpeg concatenation failed (exit code ${concatCode}).`
          );
        }

        const data = await ffmpeg.readFile(outputFile);
        finalBytes =
          data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data));
      }

      const blob = new Blob([finalBytes.buffer as ArrayBuffer], {
        type: "video/mp4",
      });
      const outUrl = URL.createObjectURL(blob);

      if (smoothVideoUrl) URL.revokeObjectURL(smoothVideoUrl);
      setSmoothVideoUrl(outUrl);
      setSmoothVideoSize(blob.size);
      setSmoothDuration(keptDuration);
      setOverallProgress(100);
      setStatusMessage(
        `Done! Removed ${Math.max(0, totalDur - keptDuration).toFixed(
          1
        )}s of dead silence & fillers across ${enabledCount} smooth jump cuts.`
      );
    } finally {
      try {
        if (usedWorkerFS) {
          await ffmpeg.unmount(mountDir);
          await ffmpeg.deleteDir(mountDir);
        } else if (inputPath) {
          await ffmpeg.deleteFile(inputPath);
        }
        for (const f of segmentFiles) {
          await ffmpeg.deleteFile(f).catch(() => {});
        }
        await ffmpeg.deleteFile("concat_list.txt").catch(() => {});
        await ffmpeg.deleteFile(outputFile).catch(() => {});
      } catch {
        // ignore cleanup errors
      }
      releaseFFmpeg();
    }
  };

  /**
   * Full 3-Stage Auto-Edit Pipeline:
   * 1. Transcribing Audio -> 2. Analyzing for Cuts -> 3. Rendering Final Video
   */
  const handleRunSmartAutoEdit = async () => {
    if (!videoFile || pipelineStatus === "running") return;

    setPipelineStatus("running");
    setError(null);
    setCompletedStages([]);
    setCurrentStage("transcribing");
    setOverallProgress(3);
    setCuts([]);
    setTranscriptChunks([]);
    setFullTranscript("");

    try {
      // STAGE 1: Transcribing Audio (FFmpeg WASM -> PCM Silence Scan -> Whisper AI)
      const wavBuffer = await extract16kWav(videoFile);
      const parsed =
        parsePcm16MonoWav(wavBuffer) || (await decodeAudioTo16kHzMono(wavBuffer));
      const actualDuration =
        videoDuration > 0 ? videoDuration : parsed.duration;
      if (videoDuration === 0 && parsed.duration > 0) {
        setVideoDuration(parsed.duration);
      }

      // Compute exact acoustic silence gaps before transferring PCM buffer to Whisper Worker
      const preset = SENSITIVITY_CONFIG[sensitivity];
      const acousticSilences = detectAcousticSilences(
        parsed.pcm,
        16000,
        preset.rmsThreshold,
        preset.minSilenceSec,
        preset.padSec
      );

      const whisperResult = await transcribeAudioWithWhisper(
        parsed.pcm,
        actualDuration,
        selectedLanguage
      );

      setFullTranscript(whisperResult.text);
      setTranscriptChunks(whisperResult.chunks);
      setCompletedStages(["transcribing"]);

      // STAGE 2: Analyzing for Cuts (Send timestamped transcript + silence hints to Gemini API)
      setCurrentStage("analyzing");
      setOverallProgress(52);
      setStatusMessage(
        "Sending timestamped transcript to Gemini AI to identify silences, pauses & filler words..."
      );

      const formattedTimestampedTranscript =
        whisperResult.chunks.length > 0
          ? whisperResult.chunks
              .map((chunk) => {
                const s =
                  typeof chunk.timestamp?.[0] === "number"
                    ? chunk.timestamp[0].toFixed(2)
                    : "0.00";
                const e =
                  typeof chunk.timestamp?.[1] === "number"
                    ? chunk.timestamp[1].toFixed(2)
                    : actualDuration.toFixed(2);
                return `[${s}s - ${e}s] ${chunk.text}`;
              })
              .join("\n")
          : whisperResult.text;

      const analyzeRes = await fetch("/api/analyze-video-cuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestampedTranscript: formattedTimestampedTranscript,
          silenceHints: acousticSilences,
          videoDurationSeconds: actualDuration,
        }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(
          analyzeData.error || "Gemini AI failed to analyze cut points."
        );
      }

      const detectedCuts: CutRange[] = (
        Array.isArray(analyzeData.cuts) ? analyzeData.cuts : []
      ).map(
        (c: { start: number; end: number; reason?: string }, idx: number) => ({
          id: `cut-${idx}-${c.start}-${c.end}`,
          start: Number(c.start),
          end: Number(c.end),
          reason: c.reason || "Silence / Filler",
          enabled: true,
        })
      );

      setCuts(detectedCuts);
      setCompletedStages(["transcribing", "analyzing"]);
      setOverallProgress(65);

      // STAGE 3: Rendering Final Video (FFmpeg -ss/-to + concat locally)
      setCurrentStage("rendering");
      await renderSmoothVideo(videoFile, detectedCuts, actualDuration);

      setCompletedStages(["transcribing", "analyzing", "rendering"]);
      setCurrentStage(null);
      setPipelineStatus("done");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during AI Smart Jump-Cut editing."
      );
      setPipelineStatus("error");
      setCurrentStage(null);
    }
  };

  const handleToggleCut = (cutId: string) => {
    setCuts((prev) =>
      prev.map((c) => (c.id === cutId ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleReRender = async () => {
    if (!videoFile || reRendering || pipelineStatus === "running") return;
    setReRendering(true);
    setError(null);
    setCurrentStage("rendering");
    try {
      await renderSmoothVideo(videoFile, cuts, videoDuration);
      setPipelineStatus("done");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to re-render smooth video."
      );
    } finally {
      setCurrentStage(null);
      setReRendering(false);
    }
  };

  const resetAll = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    if (smoothVideoUrl) URL.revokeObjectURL(smoothVideoUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(0);
    setSmoothVideoUrl(null);
    setSmoothVideoSize(0);
    setSmoothDuration(0);
    setTranscriptChunks([]);
    setFullTranscript("");
    setCuts([]);
    setPipelineStatus("idle");
    setCurrentStage(null);
    setCompletedStages([]);
    setOverallProgress(0);
    setError(null);
    setStatusMessage(
      "Upload a talking-head video to automatically cut silences and filler words."
    );
  };

  const enabledCuts = cuts.filter((c) => c.enabled);
  const totalRemovedSec = enabledCuts.reduce(
    (sum, c) => sum + (c.end - c.start),
    0
  );
  const fillerWordCount = countFillerWords(fullTranscript);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <BackButton />

        {/* Hero Header */}
        <div className="bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-rose-500/10 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <Scissors className="w-3.5 h-3.5" />
              Smart Jump-Cut Editor
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Client-Side Video Rendering
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            AI Smart Jump-Cut Editor &amp; Silence Remover
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed">
            Upload a raw talking-head video, vlog, or podcast clip. Whisper AI
            transcribes your speech locally, Gemini flags awkward pauses, dead
            silences, and filler words (&ldquo;um&rdquo;, &ldquo;uh&rdquo;,
            &ldquo;ah&rdquo;), and FFmpeg WebAssembly stitches a smooth,
            professionally paced MP4 right inside your browser.
          </p>
        </div>

        {/* Required Talking-Head & Browser Processing Warning Note */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs md:text-sm leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-amber-100">Note: </strong>
            This tool currently works best for talking-head videos (podcasts,
            vlogs). Large videos may take time to process in your browser. Keep
            the tab open.
          </p>
        </div>

        {/* Upload Dropzone & Controls Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl shadow-black/25">
          {!videoFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
                isDragActive
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-slate-700 hover:border-indigo-500/60 bg-slate-950/60"
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                <Upload className="w-7 h-7 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1.5">
                {isDragActive
                  ? "Drop your talking-head video here"
                  : "Drag & Drop Your Talking-Head Video"}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mb-4">
                Supports MP4, MOV, WebM, MKV, and AVI — processed locally via
                FFmpeg WASM &amp; Whisper AI
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25">
                <Video className="w-4 h-4" />
                Select Video File
              </span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Loaded File Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {videoFile.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(videoFile.size)}
                      {videoDuration > 0
                        ? ` • ${formatSeconds(videoDuration)} duration`
                        : ""}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetAll}
                  disabled={pipelineStatus === "running" || reRendering}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Change Video
                </button>
              </div>

              {/* Original Video Preview */}
              {videoPreviewUrl && !smoothVideoUrl && (
                <div className="rounded-xl overflow-hidden bg-black border border-slate-800">
                  <video
                    src={videoPreviewUrl}
                    controls
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setVideoDuration(d);
                    }}
                    className="w-full max-h-[360px] mx-auto"
                  />
                </div>
              )}

              {/* Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    Spoken Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={pipelineStatus === "running" || reRendering}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                    Pause &amp; Silence Sensitivity
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(SENSITIVITY_CONFIG) as SensitivityMode[]).map(
                      (mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSensitivity(mode)}
                          disabled={pipelineStatus === "running" || reRendering}
                          className={`px-2.5 py-2 rounded-lg text-xs font-bold border transition ${
                            sensitivity === mode
                              ? "bg-indigo-600/25 border-indigo-500 text-indigo-200"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {SENSITIVITY_CONFIG[mode].label}
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {SENSITIVITY_CONFIG[sensitivity].desc}
                  </p>
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleRunSmartAutoEdit}
                disabled={pipelineStatus === "running" || reRendering}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:via-purple-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-sm md:text-base transition flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25"
              >
                {pipelineStatus === "running" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Auto-Editing Video Locally ({overallProgress}%)...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Auto-Edit &amp; Remove Silences / Filler Words
                  </>
                )}
              </button>
            </div>
          )}

          {/* 3-Stage Live Progress Bar: Transcribing Audio -> Analyzing for Cuts -> Rendering Final Video */}
          {(pipelineStatus === "running" ||
            pipelineStatus === "done" ||
            reRendering) && (
            <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isDone = completedStages.includes(stage.id);
                  const isActive = currentStage === stage.id;
                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                          : isActive
                          ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-200"
                          : "bg-slate-900/70 border-slate-800 text-slate-500"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <span>{stage.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(4, overallProgress))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{statusMessage}</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {overallProgress}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs md:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-300">Processing Issue</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Smooth Output Video & Download Section */}
        {smoothVideoUrl && (
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-6 space-y-6 shadow-xl shadow-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Smooth Jump-Cut Ready
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  Your Smooth Edited Video
                </h2>
              </div>

              <a
                href={smoothVideoUrl}
                download={`smooth-${(videoFile?.name || "video").replace(/\.[^.]+$/, "")}.mp4`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/25"
              >
                <Download className="w-4 h-4" />
                Download Smooth Video
              </a>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Original Length
                </p>
                <p className="text-lg font-extrabold text-white font-mono mt-0.5">
                  {formatSeconds(videoDuration)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30">
                <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
                  Smooth Length
                </p>
                <p className="text-lg font-extrabold text-emerald-300 font-mono mt-0.5">
                  {formatSeconds(smoothDuration)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30">
                <p className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold">
                  Dead Air Removed
                </p>
                <p className="text-lg font-extrabold text-rose-300 font-mono mt-0.5">
                  -{totalRemovedSec.toFixed(1)}s
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Output Size
                </p>
                <p className="text-lg font-extrabold text-indigo-300 font-mono mt-0.5">
                  {formatBytes(smoothVideoSize)}
                </p>
              </div>
            </div>

            {/* Smooth Video Player */}
            <div className="rounded-xl overflow-hidden bg-black border border-slate-800">
              <video
                src={smoothVideoUrl}
                controls
                className="w-full max-h-[420px] mx-auto"
              />
            </div>
          </div>
        )}

        {/* Transcribed Text (Filler Words Highlighted in Red) + Editable Cut List */}
        {(fullTranscript || cuts.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Transcript Panel with Red Filler Word Highlights */}
            <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Transcribed Text (Removed Fillers Highlighted)
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                  {fillerWordCount} Filler Word{fillerWordCount === 1 ? "" : "s"} Flagged
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Filler words like{" "}
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 line-through font-semibold">
                  um
                </span>{" "}
                and{" "}
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 line-through font-semibold">
                  uh
                </span>{" "}
                plus cut sections are highlighted in red below so you can see
                exactly what the AI removed.
              </p>

              <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                {transcriptChunks.length > 0 ? (
                  transcriptChunks.map((chunk, idx) => {
                    const start = chunk.timestamp?.[0] ?? 0;
                    const end = chunk.timestamp?.[1] ?? start + 2;
                    const overlapsCut = enabledCuts.some(
                      (c) => c.start < end && c.end > start
                    );
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs md:text-sm leading-relaxed ${
                          overlapsCut
                            ? "bg-rose-500/5 border-rose-500/25 text-slate-200"
                            : "bg-slate-950/70 border-slate-800/80 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                            {formatSeconds(start)} – {formatSeconds(end)}
                          </span>
                          {overlapsCut && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Contains Cut
                            </span>
                          )}
                        </div>
                        <p>{renderHighlightedFillers(chunk.text)}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-200 leading-relaxed">
                    {renderHighlightedFillers(fullTranscript)}
                  </div>
                )}
              </div>
            </div>

            {/* Detected Cuts Sidebar (Toggleable + Re-Render) */}
            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-rose-400" />
                    AI Cut Ranges ({enabledCuts.length}/{cuts.length})
                  </h2>
                </div>

                {cuts.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    No long silences or standalone fillers were detected at the
                    current sensitivity level. Switch to{" "}
                    <strong className="text-slate-200">Tight Cuts</strong> and
                    run again for tighter pacing.
                  </p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {cuts.map((cut) => (
                      <label
                        key={cut.id}
                        className={`flex items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer transition text-xs ${
                          cut.enabled
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                            : "bg-slate-950/60 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={cut.enabled}
                            onChange={() => handleToggleCut(cut.id)}
                            className="accent-rose-500 rounded"
                          />
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-white">
                              {formatSeconds(cut.start)} →{" "}
                              {formatSeconds(cut.end)}
                            </p>
                            <p className="text-[11px] truncate opacity-85">
                              {cut.reason}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold shrink-0 px-2 py-0.5 rounded bg-slate-900 text-rose-300">
                          -{(cut.end - cut.start).toFixed(1)}s
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {cuts.length > 0 && (
                <button
                  type="button"
                  onClick={handleReRender}
                  disabled={reRendering || pipelineStatus === "running"}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  {reRendering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Re-Rendering Selected Cuts...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Apply Checked Cuts &amp; Re-Render
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Helpful Guide Banner */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">
                Want Studio-Grade Jump Cuts on Every Recording?
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Read our step-by-step tutorial on filming and auto-editing
                talking-head videos without paid software.
              </p>
            </div>
          </div>
          <Link
            href="/blog/how-to-auto-edit-videos-and-remove-silences-for-free"
            className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            Read Auto-Edit Guide
          </Link>
        </div>

        <ToolSeoContent
          toolName="Smart AI Jump-Cut Editor & Silence Remover"
          aboutParagraphs={[
            "Our Smart AI Jump-Cut Editor automatically edits raw talking-head videos, YouTube tutorials, webcam explainers, and podcasts directly inside your web browser—removing awkward silences, long pauses, and distracting filler words like 'um', 'uh', and 'ah' without needing paid editing software like Premiere Pro or Descript.",
            "First, FFmpeg WebAssembly extracts a clean 16kHz audio track locally and scans the waveform for dead air while OpenAI Whisper transcribes your speech with timestamps inside a browser Web Worker. Next, Gemini AI analyzes the timestamped transcript to pinpoint the exact start and end seconds to remove—highlighting filler words in red right on screen—before FFmpeg slices the good parts with subtle 30ms audio micro-fades and merges them into a single smooth MP4 download.",
          ]}
          howToSteps={[
            {
              title: "Upload Your Talking-Head Video",
              detail:
                "Drag and drop an MP4, MOV, or WebM video into the browser. Your video file stays strictly on your own device with zero cloud video uploads.",
            },
            {
              title: "AI Transcribes & Detects Silence / Fillers",
              detail:
                "Whisper AI builds a timestamped transcript locally while Gemini AI flags silences, long pauses, and filler words ('um', 'uh', 'ah'), highlighting them in red.",
            },
            {
              title: "Render & Download Smooth Video",
              detail:
                "FFmpeg WebAssembly cuts out dead air, smooths transitions with 30ms audio micro-fades, and merges the crisp segments into one downloadable MP4.",
            },
          ]}
          highlights={[
            "100% client-side FFmpeg WebAssembly video rendering—your raw footage never uploads to a remote cloud server.",
            "Combines local Whisper AI timestamped transcription with Gemini AI silence & filler-word detection.",
            "Highlights detected filler words ('um', 'uh', 'ah') in red and lets you toggle any cut range on or off before downloading.",
            "Adds subtle 30ms audio micro-fades at jump-cut boundaries to prevent digital clicks or pops between spoken segments.",
          ]}
        />
      </div>
    </div>
  );
}
