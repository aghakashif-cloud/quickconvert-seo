"use client";

import React, { useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { jsPDF } from "jspdf";
import mammoth from "mammoth";
import { fileTypeFromBuffer } from "file-type";
import {
  Upload,
  FileVideo,
  FileAudio,
  FileImage,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Sliders,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2,
} from "lucide-react";

type FileCategory = "image" | "video" | "audio" | "pdf" | "document" | "unknown";

interface AdvancedSettings {
  // Image options
  quality: number; // 1 - 100
  resizeWidth: string;
  resizeHeight: string;
  // Video / Audio options
  resolution: "original" | "1920:1080" | "1280:720" | "854:480";
  bitrate: "auto" | "128k" | "192k" | "320k" | "2M";
  trimStart: string; // e.g., "00:00:00" or seconds
  trimEnd: string;   // e.g., "00:00:10" or seconds
}

interface QueueItem {
  id: string;
  file: File;
  detectedMime: string;
  category: FileCategory;
  targetFormat: string;
  showAdvanced: boolean;
  advanced: AdvancedSettings;
  status: "idle" | "converting" | "done" | "error";
  progress: number;
  outputUrl?: string;
  outputName?: string;
  outputSize?: number;
  statusMessage?: string;
  errorMessage?: string;
}

const FORMAT_OPTIONS: Record<
  FileCategory,
  { label: string; value: string; mime: string }[]
> = {
  image: [
    { label: "PNG (Lossless)", value: "png", mime: "image/png" },
    { label: "JPG / JPEG", value: "jpg", mime: "image/jpeg" },
    { label: "WebP (Modern)", value: "webp", mime: "image/webp" },
    { label: "AVIF (Next-Gen)", value: "avif", mime: "image/avif" },
    { label: "BMP (Bitmap)", value: "bmp", mime: "image/bmp" },
    { label: "ICO (Icon 64x64)", value: "ico", mime: "image/x-icon" },
    { label: "PDF (Image to PDF)", value: "pdf", mime: "application/pdf" },
  ],
  video: [
    { label: "MP4 (H.264 Universal)", value: "mp4", mime: "video/mp4" },
    { label: "WebM (VP8 Web)", value: "webm", mime: "video/webm" },
    { label: "GIF (Animated)", value: "gif", mime: "image/gif" },
    { label: "AVI (Audio Video Interleave)", value: "avi", mime: "video/x-msvideo" },
    { label: "MKV (Matroska)", value: "mkv", mime: "video/x-matroska" },
    { label: "MP3 (Extract Audio)", value: "mp3", mime: "audio/mpeg" },
    { label: "WAV (Extract Lossless Audio)", value: "wav", mime: "audio/wav" },
  ],
  audio: [
    { label: "MP3 (Universal)", value: "mp3", mime: "audio/mpeg" },
    { label: "WAV (Uncompressed PCM)", value: "wav", mime: "audio/wav" },
    { label: "OGG (Vorbis)", value: "ogg", mime: "audio/ogg" },
    { label: "M4A / AAC", value: "m4a", mime: "audio/mp4" },
    { label: "FLAC (Lossless)", value: "flac", mime: "audio/flac" },
  ],
  pdf: [
    { label: "PNG (PDF Page to PNG)", value: "png", mime: "image/png" },
    { label: "JPG (PDF Page to JPG)", value: "jpg", mime: "image/jpeg" },
    { label: "TXT (Extract PDF Text)", value: "txt", mime: "text/plain" },
  ],
  document: [
    { label: "PDF (Document to PDF)", value: "pdf", mime: "application/pdf" },
    { label: "TXT (Plain Text)", value: "txt", mime: "text/plain" },
    { label: "HTML (Formatted HTML)", value: "html", mime: "text/html" },
  ],
  unknown: [],
};

// Smart file type detection using magic bytes (file-type) + MIME + extension fallback
async function detectSmartCategory(
  file: File
): Promise<{ category: FileCategory; detectedMime: string; ext: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  let mime = file.type.toLowerCase();

  try {
    const slice = await file.slice(0, 4100).arrayBuffer();
    const detected = await fileTypeFromBuffer(new Uint8Array(slice));
    if (detected) {
      // Note: DOCX is a zip container, so check extension for docx first
      if (ext === "docx" || file.type.includes("wordprocessingml")) {
        return {
          category: "document",
          detectedMime:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ext: "docx",
        };
      }
      mime = detected.mime.toLowerCase();
    }
  } catch {
    // Fallback to browser MIME and file extension
  }

  if (mime === "application/pdf" || ext === "pdf") {
    return { category: "pdf", detectedMime: "application/pdf", ext: "pdf" };
  }

  if (
    ext === "docx" ||
    ext === "doc" ||
    ext === "txt" ||
    ext === "md" ||
    ext === "rtf" ||
    mime.includes("wordprocessingml") ||
    mime.startsWith("text/")
  ) {
    return {
      category: "document",
      detectedMime: mime || "text/plain",
      ext,
    };
  }

  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "avif", "bmp", "ico", "gif", "svg"].includes(ext)
  ) {
    return { category: "image", detectedMime: mime || `image/${ext}`, ext };
  }

  if (
    mime.startsWith("video/") ||
    ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv"].includes(ext)
  ) {
    return { category: "video", detectedMime: mime || `video/${ext}`, ext };
  }

  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"].includes(ext)
  ) {
    return { category: "audio", detectedMime: mime || `audio/${ext}`, ext };
  }

  return { category: "unknown", detectedMime: mime || "unknown", ext };
}

function getDefaultTargetFormat(category: FileCategory, currentExt: string): string {
  const options = FORMAT_OPTIONS[category];
  if (!options || options.length === 0) return "";
  if (category === "image" && currentExt === "png") return "webp";
  if (category === "image" && (currentExt === "jpg" || currentExt === "jpeg")) return "png";
  if (category === "video" && currentExt === "mp4") return "mp3";
  if (category === "video" && currentExt === "mov") return "mp4";
  if (category === "pdf") return "png";
  if (category === "document" && currentExt === "docx") return "pdf";
  if (category === "document" && currentExt === "txt") return "pdf";
  const diff = options.find((o) => o.value !== currentExt);
  return diff ? diff.value : options[0].value;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper to build a valid uncompressed 24/32-bit BMP file buffer from ImageData
function encodeBMPFromCanvas(canvas: HTMLCanvasElement): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const rowSize = Math.floor((32 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Bitmap file header (14 bytes)
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);

  // DIB header BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // top-down
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true); // 32-bit BGRA
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      view.setUint8(offset++, imgData[idx + 2]); // B
      view.setUint8(offset++, imgData[idx + 1]); // G
      view.setUint8(offset++, imgData[idx]);     // R
      view.setUint8(offset++, imgData[idx + 3]); // A
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

// Helper to wrap a PNG blob inside a valid Windows .ICO container
async function encodeICOFromCanvas(sourceCanvas: HTMLCanvasElement): Promise<Blob> {
  const iconCanvas = document.createElement("canvas");
  iconCanvas.width = 64;
  iconCanvas.height = 64;
  const ctx = iconCanvas.getContext("2d")!;
  ctx.drawImage(sourceCanvas, 0, 0, 64, 64);

  const pngBlob: Blob = await new Promise((res, rej) =>
    iconCanvas.toBlob((b) => (b ? res(b) : rej(new Error("ICO PNG encode failed"))), "image/png")
  );
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  const icoBuffer = new ArrayBuffer(22 + pngBytes.length);
  const view = new DataView(icoBuffer);

  // ICONDIR header (6 bytes)
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type 1 = ICO
  view.setUint16(4, 1, true); // 1 image

  // ICONDIRENTRY (16 bytes)
  view.setUint8(6, 64);  // Width
  view.setUint8(7, 64);  // Height
  view.setUint8(8, 0);   // Color palette
  view.setUint8(9, 0);   // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, pngBytes.length, true); // Image size
  view.setUint32(18, 22, true); // Offset

  new Uint8Array(icoBuffer, 22).set(pngBytes);
  return new Blob([icoBuffer], { type: "image/x-icon" });
}

export default function FileConverter() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegLog, setFfmpegLog] = useState<string>("");
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const activeItemIdRef = useRef<string | null>(null);

  // Load FFmpeg WASM on demand
  const ensureFFmpegLoaded = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegLoaded) {
      return ffmpegRef.current;
    }

    setFfmpegLoading(true);
    setFfmpegLog("Initializing local FFmpeg WebAssembly engine...");

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on("log", ({ message }) => {
        setFfmpegLog(message);
      });

      ffmpeg.on("progress", ({ progress }) => {
        const currentId = activeItemIdRef.current;
        if (currentId) {
          const pct = Math.min(98, Math.max(8, Math.round(progress * 100)));
          setQueue((prev) =>
            prev.map((item) =>
              item.id === currentId ? { ...item, progress: pct } : item
            )
          );
        }
      });

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setFfmpegLoaded(true);
      setFfmpegLoading(false);
      setFfmpegLog("FFmpeg WASM ready (100% browser-local)");
      return ffmpeg;
    } catch (err) {
      setFfmpegLoading(false);
      throw new Error(
        `Failed to initialize FFmpeg WASM: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Smart Dropzone Handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newItems: QueueItem[] = [];

    for (const file of acceptedFiles) {
      const { category, detectedMime, ext } = await detectSmartCategory(file);
      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        detectedMime,
        category,
        targetFormat: getDefaultTargetFormat(category, ext),
        showAdvanced: false,
        advanced: {
          quality: 92,
          resizeWidth: "",
          resizeHeight: "",
          resolution: "original",
          bitrate: "auto",
          trimStart: "",
          trimEnd: "",
        },
        status: category === "unknown" ? "error" : "idle",
        progress: 0,
        errorMessage:
          category === "unknown"
            ? "Unsupported file format. Please drop an Image, Video, Audio, PDF, or Document."
            : undefined,
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  // Instant Sample File Generators for 1-click testing across all categories
  const addDemoSample = async (type: "image" | "audio" | "pdf" | "document") => {
    if (type === "image") {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 800, 500);
        grad.addColorStop(0, "#4f46e5");
        grad.addColorStop(0.5, "#9333ea");
        grad.addColorStop(1, "#ec4899");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 500);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Funntogo Universal Converter", 400, 225);
        ctx.font = "22px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Convert to PNG, JPG, WebP, AVIF, BMP, ICO, or PDF", 400, 280);
      }
      canvas.toBlob((blob) => {
        if (!blob) return;
        const sampleFile = new File([blob], "sample-artwork.png", { type: "image/png" });
        onDrop([sampleFile]);
      }, "image/png");
    } else if (type === "audio") {
      const sampleRate = 44100;
      const durationSeconds = 2;
      const numSamples = sampleRate * durationSeconds;
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeString(0, "RIFF");
      view.setUint32(4, 36 + numSamples * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, "data");
      view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = t < 1 ? 440 : 554.37;
        const envelope = Math.exp(-2.5 * (t % 1));
        const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6;
        view.setInt16(44 + i * 2, sample * 32767, true);
      }
      const wavBlob = new Blob([buffer], { type: "audio/wav" });
      onDrop([new File([wavBlob], "sample-chime.wav", { type: "audio/wav" })]);
    } else if (type === "pdf") {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawRectangle({
        x: 0,
        y: 0,
        width: 600,
        height: 400,
        color: rgb(0.08, 0.1, 0.18),
      });
      page.drawText("Funntogo Universal PDF Sample", {
        x: 50,
        y: 310,
        size: 26,
        font,
        color: rgb(0.5, 0.55, 0.98),
      });
      page.drawText(
        "This PDF was generated 100% locally in your browser using pdf-lib.",
        { x: 50, y: 260, size: 14, font: bodyFont, color: rgb(0.9, 0.92, 0.95) }
      );
      page.drawText(
        "Convert this PDF into high-resolution PNG, JPG, or extracted TXT!",
        { x: 50, y: 230, size: 14, font: bodyFont, color: rgb(0.7, 0.75, 0.85) }
      );

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      onDrop([new File([pdfBlob], "sample-brochure.pdf", { type: "application/pdf" })]);
    } else if (type === "document") {
      const sampleText = `FUNNTOGO TOOLS — UNIVERSAL DOCUMENT CONVERTER\n\n1. 100% Client-Side Processing\nYour documents, PDFs, videos, audio tracks, and images never leave your device.\n\n2. Supported Document Workflows\n- Convert TXT, Markdown, or DOCX files directly to formatted PDF documents using jsPDF & mammoth.js.\n- Extract clean plain text or HTML from Word documents.\n\nGenerated locally on ${new Date().toLocaleDateString()}.`;
      const docBlob = new Blob([sampleText], { type: "text/plain" });
      onDrop([new File([docBlob], "sample-notes.txt", { type: "text/plain" })]);
    }
  };

  // Helper to update item progress smoothly
  const setItemProgress = (id: string, progress: number, statusMessage?: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, progress, statusMessage: statusMessage ?? item.statusMessage }
          : item
      )
    );
  };

  // 1. IMAGE CONVERSIONS (HTML5 Canvas + pdf-lib for Image->PDF)
  const convertImage = async (
    item: QueueItem
  ): Promise<{ url: string; size: number; outputName: string }> => {
    setItemProgress(item.id, 25, "Decoding image into HTML5 Canvas...");

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(item.file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to decode image in browser."));
      };
      image.src = objectUrl;
    });

    const targetW =
      parseInt(item.advanced.resizeWidth, 10) > 0
        ? parseInt(item.advanced.resizeWidth, 10)
        : img.naturalWidth || img.width;
    const targetH =
      parseInt(item.advanced.resizeHeight, 10) > 0
        ? parseInt(item.advanced.resizeHeight, 10)
        : img.naturalHeight || img.height;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D Canvas context.");

    if (item.targetFormat === "jpg" || item.targetFormat === "bmp") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    setItemProgress(item.id, 65, `Encoding ${item.targetFormat.toUpperCase()}...`);
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const outputName = `${baseName}-converted.${item.targetFormat}`;
    const qualityRatio = Math.min(1, Math.max(0.05, item.advanced.quality / 100));

    // Image -> PDF using pdf-lib
    if (item.targetFormat === "pdf") {
      const pngBlob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas to PNG failed"))), "image/png")
      );
      const pngBytes = await pngBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.create();
      const embeddedImage = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.addPage([targetW, targetH]);
      page.drawImage(embeddedImage, { x: 0, y: 0, width: targetW, height: targetH });
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      return {
        url: URL.createObjectURL(pdfBlob),
        size: pdfBlob.size,
        outputName,
      };
    }

    // Image -> BMP
    if (item.targetFormat === "bmp") {
      const bmpBlob = encodeBMPFromCanvas(canvas);
      return {
        url: URL.createObjectURL(bmpBlob),
        size: bmpBlob.size,
        outputName,
      };
    }

    // Image -> ICO
    if (item.targetFormat === "ico") {
      const icoBlob = await encodeICOFromCanvas(canvas);
      return {
        url: URL.createObjectURL(icoBlob),
        size: icoBlob.size,
        outputName,
      };
    }

    // Standard Canvas formats: PNG, JPG, WebP, AVIF
    const formatOption = FORMAT_OPTIONS.image.find((f) => f.value === item.targetFormat);
    const requestedMime = formatOption ? formatOption.mime : "image/png";

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas conversion failed to produce a valid image blob."));
        },
        requestedMime,
        qualityRatio
      );
    });

    return {
      url: URL.createObjectURL(blob),
      size: blob.size,
      outputName,
    };
  };

  // 2. VIDEO & AUDIO CONVERSIONS (@ffmpeg/ffmpeg WASM with Resolution, Bitrate & Trim)
  const convertMediaWithFFmpeg = async (
    item: QueueItem
  ): Promise<{ url: string; size: number; outputName: string }> => {
    setItemProgress(item.id, 10, "Loading FFmpeg WebAssembly engine...");
    const ffmpeg = await ensureFFmpegLoaded();
    activeItemIdRef.current = item.id;

    const inputExt = item.file.name.split(".").pop()?.toLowerCase() || "dat";
    const safeId = item.id.replace(/[^a-zA-Z0-9]/g, "");
    const inputFileName = `in_${safeId}.${inputExt}`;
    const outputFileName = `out_${safeId}.${item.targetFormat}`;

    setItemProgress(item.id, 20, "Writing media buffer to local WASM filesystem...");
    await ffmpeg.writeFile(inputFileName, await fetchFile(item.file));

    const args: string[] = [];

    // Optional Trim Start
    if (item.advanced.trimStart.trim()) {
      args.push("-ss", item.advanced.trimStart.trim());
    }

    args.push("-i", inputFileName);

    // Optional Trim End
    if (item.advanced.trimEnd.trim()) {
      args.push("-to", item.advanced.trimEnd.trim());
    }

    const isAudioOutput = ["mp3", "wav", "ogg", "m4a", "flac"].includes(
      item.targetFormat
    );

    if (isAudioOutput) {
      args.push("-vn");
      if (item.targetFormat === "mp3") {
        args.push("-acodec", "libmp3lame");
      } else if (item.targetFormat === "wav") {
        args.push("-acodec", "pcm_s16le");
      } else if (item.targetFormat === "ogg") {
        args.push("-acodec", "libvorbis");
      } else if (item.targetFormat === "m4a") {
        args.push("-acodec", "aac");
      } else if (item.targetFormat === "flac") {
        args.push("-acodec", "flac");
      }

      if (
        item.advanced.bitrate !== "auto" &&
        ["128k", "192k", "320k"].includes(item.advanced.bitrate)
      ) {
        args.push("-b:a", item.advanced.bitrate);
      }
    } else {
      // Video / GIF output
      if (item.targetFormat === "gif") {
        const scaleFilter =
          item.advanced.resolution !== "original"
            ? `fps=10,scale=${item.advanced.resolution}:flags=lanczos`
            : "fps=10,scale=480:-1:flags=lanczos";
        args.push("-vf", scaleFilter);
      } else {
        if (item.advanced.resolution !== "original") {
          args.push("-vf", `scale=${item.advanced.resolution}`);
        }
        if (item.targetFormat === "mp4" || item.targetFormat === "mkv") {
          args.push(
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac"
          );
        }
        if (item.advanced.bitrate !== "auto") {
          args.push("-b:v", item.advanced.bitrate);
        }
      }
    }

    args.push(outputFileName);

    setItemProgress(item.id, 30, `Transcoding to .${item.targetFormat.toUpperCase()}...`);
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    const data = await ffmpeg.readFile(outputFileName);
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch {
      // ignore virtual fs cleanup errors
    }

    const formatList = [...FORMAT_OPTIONS.video, ...FORMAT_OPTIONS.audio];
    const matchedMime =
      formatList.find((f) => f.value === item.targetFormat)?.mime ||
      "application/octet-stream";

    const uint8 =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const blob = new Blob([uint8.buffer as ArrayBuffer], { type: matchedMime });
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const outputName = `${baseName}-converted.${item.targetFormat}`;

    activeItemIdRef.current = null;
    return { url: URL.createObjectURL(blob), size: blob.size, outputName };
  };

  // 3. PDF CONVERSIONS (PDF to PNG / JPG / TXT using pdfjs-dist & HTML5 Canvas)
  const convertPdf = async (
    item: QueueItem
  ): Promise<{ url: string; size: number; outputName: string }> => {
    setItemProgress(item.id, 20, "Loading PDF document locally...");
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

    const arrayBuffer = await item.file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const outputName = `${baseName}-converted.${item.targetFormat}`;

    if (item.targetFormat === "txt") {
      setItemProgress(item.id, 55, `Extracting text from ${pdf.numPages} page(s)...`);
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((it) => ("str" in it ? it.str : ""));
        fullText += `--- Page ${i} ---\n${strings.join(" ")}\n\n`;
      }
      const txtBlob = new Blob([fullText.trim() || "No extractable text found in PDF."], {
        type: "text/plain;charset=utf-8",
      });
      return {
        url: URL.createObjectURL(txtBlob),
        size: txtBlob.size,
        outputName,
      };
    }

    // Render PDF page(s) onto a high-res Canvas for PNG or JPG output
    setItemProgress(item.id, 55, "Rendering PDF page to high-resolution Canvas...");
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    if (item.targetFormat === "jpg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;

    const mime = item.targetFormat === "jpg" ? "image/jpeg" : "image/png";
    const qualityRatio = Math.min(1, Math.max(0.1, item.advanced.quality / 100));

    const outBlob: Blob = await new Promise((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error("Failed to export PDF canvas to image."))),
        mime,
        qualityRatio
      )
    );

    return {
      url: URL.createObjectURL(outBlob),
      size: outBlob.size,
      outputName,
    };
  };

  // 4. DOCUMENT CONVERSIONS (DOCX / TXT / MD -> PDF / TXT / HTML using mammoth.js & jsPDF)
  const convertDocument = async (
    item: QueueItem
  ): Promise<{ url: string; size: number; outputName: string }> => {
    setItemProgress(item.id, 25, "Parsing document contents locally...");
    const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    const outputName = `${baseName}-converted.${item.targetFormat}`;

    let extractedText = "";
    let extractedHtml = "";

    if (ext === "docx" || item.detectedMime.includes("wordprocessingml")) {
      const arrayBuffer = await item.file.arrayBuffer();
      const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
      extractedText = rawTextResult.value || "";
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      extractedHtml = htmlResult.value || `<p>${extractedText}</p>`;
    } else {
      extractedText = await item.file.text();
      extractedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;line-height:1.6;padding:0 1rem;}</style></head><body><pre style="white-space:pre-wrap;font-family:inherit;">${extractedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre></body></html>`;
    }

    setItemProgress(item.id, 70, `Generating ${item.targetFormat.toUpperCase()} file...`);

    if (item.targetFormat === "txt") {
      const blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
      return { url: URL.createObjectURL(blob), size: blob.size, outputName };
    }

    if (item.targetFormat === "html") {
      const blob = new Blob([extractedHtml], { type: "text/html;charset=utf-8" });
      return { url: URL.createObjectURL(blob), size: blob.size, outputName };
    }

    // Document -> PDF via jsPDF
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 45;
    const maxLineWidth = pageWidth - margin * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(baseName, margin, margin);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines: string[] = doc.splitTextToSize(
      extractedText || "(Empty document)",
      maxLineWidth
    );

    let cursorY = margin + 26;
    const lineHeight = 15;

    for (const line of lines) {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    }

    const pdfBlob = doc.output("blob");
    return {
      url: URL.createObjectURL(pdfBlob),
      size: pdfBlob.size,
      outputName,
    };
  };

  // Convert a single QueueItem
  const convertItem = async (id: string) => {
    const target = queue.find((q) => q.id === id);
    if (!target || target.status === "converting") return;

    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "converting",
              progress: 12,
              statusMessage: "Starting local conversion...",
              errorMessage: undefined,
            }
          : item
      )
    );

    try {
      let result: { url: string; size: number; outputName: string };

      if (target.category === "image") {
        result = await convertImage(target);
      } else if (target.category === "video" || target.category === "audio") {
        result = await convertMediaWithFFmpeg(target);
      } else if (target.category === "pdf") {
        result = await convertPdf(target);
      } else if (target.category === "document") {
        result = await convertDocument(target);
      } else {
        throw new Error("Unsupported file category.");
      }

      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "done",
                progress: 100,
                statusMessage: "Conversion completed 100% locally!",
                outputUrl: result.url,
                outputSize: result.size,
                outputName: result.outputName,
              }
            : item
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Conversion failed.";
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "error",
                progress: 0,
                statusMessage: undefined,
                errorMessage: msg,
              }
            : item
        )
      );
    }
  };

  // Sequential Batch Conversion
  const convertAll = async () => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);
    const pendingIds = queue
      .filter((q) => q.status === "idle" || q.status === "error")
      .map((q) => q.id);

    for (const id of pendingIds) {
      await convertItem(id);
    }
    setIsBatchRunning(false);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found?.outputUrl) URL.revokeObjectURL(found.outputUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    queue.forEach((item) => {
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    });
    setQueue([]);
  };

  const updateFormat = (id: string, targetFormat: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              targetFormat,
              status: "idle",
              progress: 0,
              outputUrl: undefined,
              statusMessage: undefined,
            }
          : item
      )
    );
  };

  const toggleAdvanced = (id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, showAdvanced: !item.showAdvanced } : item
      )
    );
  };

  const updateAdvanced = <K extends keyof AdvancedSettings>(
    id: string,
    key: K,
    value: AdvancedSettings[K]
  ) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              advanced: { ...item.advanced, [key]: value },
              status: "idle",
              progress: 0,
              outputUrl: undefined,
            }
          : item
      )
    );
  };

  const getCategoryBadge = (category: FileCategory) => {
    switch (category) {
      case "image":
        return {
          icon: <FileImage className="w-5 h-5 text-emerald-400" />,
          badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
          label: "Image",
        };
      case "video":
        return {
          icon: <FileVideo className="w-5 h-5 text-indigo-400" />,
          badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
          label: "Video",
        };
      case "audio":
        return {
          icon: <FileAudio className="w-5 h-5 text-amber-400" />,
          badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          label: "Audio",
        };
      case "pdf":
        return {
          icon: <FileSpreadsheet className="w-5 h-5 text-rose-400" />,
          badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          label: "PDF Document",
        };
      case "document":
        return {
          icon: <FileText className="w-5 h-5 text-cyan-400" />,
          badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
          label: "Document",
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          label: "Unknown",
        };
    }
  };

  const pendingCount = queue.filter(
    (q) => q.status === "idle" || q.status === "error"
  ).length;
  const completedCount = queue.filter((q) => q.status === "done").length;

  return (
    <div className="space-y-6">
      {/* Top Capabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileImage className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Images & Icons
            </h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              PNG, JPG, WebP, AVIF, BMP, ICO, PDF
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">HTML5 Canvas + Resize</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileVideo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Video & Audio
            </h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              MP4, WebM, GIF, AVI, MKV, MP3, WAV, FLAC
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">FFmpeg WASM + Trim/Scale</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              PDF Studio
            </h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              PDF to PNG/JPG/TXT & Images to PDF
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">pdf-lib & PDF.js Engine</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Documents
            </h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              DOCX to PDF/TXT/HTML & Text to PDF
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">mammoth.js & jsPDF</p>
          </div>
        </div>
      </div>

      {/* Prominent Zero-Upload Security Trust Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5 flex items-center justify-center gap-2.5 text-center shadow-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:inline" />
        <p className="text-xs md:text-sm font-medium text-emerald-400">
          🔒 100% Secure: Your files never leave your device. All conversions happen locally in your browser, not on our servers.
        </p>
      </div>

      {/* Universal Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 md:p-12 text-center ${
          isDragActive
            ? "border-indigo-400 bg-indigo-500/10 scale-[0.995]"
            : "border-slate-700/80 hover:border-indigo-500/70 bg-slate-900/50 hover:bg-slate-900/80"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <Upload className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-lg md:text-xl font-bold text-slate-100">
          {isDragActive
            ? "Drop your files here for automatic format detection..."
            : "Drag & Drop Any Files Here (Batch Supported)"}
        </h3>
        <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-2xl mx-auto">
          Automatically detects <span className="text-slate-200 font-medium">Images, Videos, Audio, PDFs, and Word/Text Documents</span> via magic-byte inspection (`file-type`) and unlocks all compatible output formats.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition">
            Select Multiple Files from Device
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4" />
            100% Client-Side • Zero Uploads
          </span>
        </div>
      </div>

      {/* One-Click Test Sample Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Instant test files (generated in browser):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addDemoSample("image")}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <FileImage className="w-3.5 h-3.5 text-emerald-400" />
            + Sample PNG
          </button>
          <button
            type="button"
            onClick={() => addDemoSample("audio")}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <FileAudio className="w-3.5 h-3.5 text-amber-400" />
            + Sample WAV
          </button>
          <button
            type="button"
            onClick={() => addDemoSample("pdf")}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-rose-400" />
            + Sample PDF
          </button>
          <button
            type="button"
            onClick={() => addDemoSample("document")}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            + Sample Document
          </button>
        </div>
      </div>

      {/* FFmpeg Engine Status Indicator */}
      {(ffmpegLoading || ffmpegLoaded) && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-300 truncate">
            {ffmpegLoading ? (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">FFmpeg WASM Engine:</span>
            <span className="text-slate-400 font-mono truncate">{ffmpegLog}</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
            {ffmpegLoaded ? "Ready" : "Loading"}
          </span>
        </div>
      )}

      {/* Multi-File Batch Queue */}
      {queue.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Queue Header & Large Batch Convert CTA */}
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/90">
            <div>
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Batch Conversion Queue ({queue.length}{" "}
                {queue.length === 1 ? "file" : "files"})
                {completedCount > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {completedCount} Completed
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize target formats or open Advanced Options per file, then convert individually or in batch.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={clearAll}
                disabled={isBatchRunning}
                className="px-3.5 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Queue
              </button>

              <button
                type="button"
                onClick={convertAll}
                disabled={isBatchRunning || pendingCount === 0}
                className="px-6 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
              >
                {isBatchRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting Batch...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Convert All ({pendingCount > 0 ? pendingCount : queue.length})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="divide-y divide-slate-800/80">
            {queue.map((item) => {
              const options = FORMAT_OPTIONS[item.category] || [];
              const badgeInfo = getCategoryBadge(item.category);
              const hasAdvancedSupport =
                item.category === "image" ||
                item.category === "video" ||
                item.category === "audio" ||
                item.category === "pdf";

              return (
                <div
                  key={item.id}
                  className="p-4 md:p-5 flex flex-col gap-3.5 hover:bg-slate-900/40 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: File Info & Smart Detection Badge */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/70 shrink-0">
                        {badgeInfo.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {item.file.name}
                          </p>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeInfo.badge}`}
                          >
                            {badgeInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                          <span>{formatBytes(item.file.size)}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {item.detectedMime}
                          </span>
                          {item.outputSize && (
                            <>
                              <span>→</span>
                              <span className="text-emerald-400 font-semibold">
                                {formatBytes(item.outputSize)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Dynamic Convert To Dropdown, Advanced Toggle & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Dynamic Convert To Dropdown */}
                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
                        <span className="text-xs text-slate-400 font-medium">
                          Convert to:
                        </span>
                        <select
                          aria-label={`Target format for ${item.file.name}`}
                          value={item.targetFormat}
                          disabled={item.status === "converting"}
                          onChange={(e) => updateFormat(item.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Collapsible Advanced Options Trigger */}
                      {hasAdvancedSupport && (
                        <button
                          type="button"
                          onClick={() => toggleAdvanced(item.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                            item.showAdvanced
                              ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                              : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80"
                          }`}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Advanced</span>
                          {item.showAdvanced ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Large Convert or Download CTA */}
                      {item.status === "done" && item.outputUrl ? (
                        <a
                          href={item.outputUrl}
                          download={item.outputName}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition"
                        >
                          <Download className="w-4 h-4" />
                          Download .{item.targetFormat.toUpperCase()}
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            item.status === "converting" ||
                            item.category === "unknown"
                          }
                          onClick={() => convertItem(item.id)}
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                        >
                          {item.status === "converting" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {item.progress}%
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Convert
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        title="Remove file"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Pro Advanced Options Panel */}
                  {item.showAdvanced && (
                    <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>
                          Advanced {badgeInfo.label} Settings
                        </span>
                      </div>

                      {(item.category === "image" || item.category === "pdf") && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Quality Slider 1 - 100 */}
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-slate-400">Compression Quality</span>
                              <span className="font-bold text-indigo-400">
                                {item.advanced.quality}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={100}
                              value={item.advanced.quality}
                              onChange={(e) =>
                                updateAdvanced(
                                  item.id,
                                  "quality",
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full accent-indigo-500 cursor-pointer"
                            />
                          </div>

                          {item.category === "image" && (
                            <>
                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <label className="block text-xs text-slate-400 mb-1">
                                  Resize Width (px)
                                </label>
                                <input
                                  type="number"
                                  placeholder="Original width"
                                  value={item.advanced.resizeWidth}
                                  onChange={(e) =>
                                    updateAdvanced(
                                      item.id,
                                      "resizeWidth",
                                      e.target.value
                                    )
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100"
                                />
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <label className="block text-xs text-slate-400 mb-1">
                                  Resize Height (px)
                                </label>
                                <input
                                  type="number"
                                  placeholder="Original height"
                                  value={item.advanced.resizeHeight}
                                  onChange={(e) =>
                                    updateAdvanced(
                                      item.id,
                                      "resizeHeight",
                                      e.target.value
                                    )
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {(item.category === "video" || item.category === "audio") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {item.category === "video" && (
                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                              <label className="block text-xs text-slate-400 mb-1">
                                Video Resolution
                              </label>
                              <select
                                aria-label="Video Resolution"
                                value={item.advanced.resolution}
                                onChange={(e) =>
                                  updateAdvanced(
                                    item.id,
                                    "resolution",
                                    e.target.value as AdvancedSettings["resolution"]
                                  )
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                              >
                                <option value="original">Keep Original</option>
                                <option value="1920:1080">1080p (1920x1080)</option>
                                <option value="1280:720">720p (1280x720)</option>
                                <option value="854:480">480p (854x480)</option>
                              </select>
                            </div>
                          )}

                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                            <label className="block text-xs text-slate-400 mb-1">
                              Target Bitrate
                            </label>
                            <select
                              aria-label="Target Bitrate"
                              value={item.advanced.bitrate}
                              onChange={(e) =>
                                updateAdvanced(
                                  item.id,
                                  "bitrate",
                                  e.target.value as AdvancedSettings["bitrate"]
                                )
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                            >
                              <option value="auto">Auto (Recommended)</option>
                              <option value="128k">128 kbps (Compact Audio)</option>
                              <option value="192k">192 kbps (Standard Audio)</option>
                              <option value="320k">320 kbps (Studio Audio)</option>
                              {item.category === "video" && (
                                <option value="2M">2 Mbps (Video Stream)</option>
                              )}
                            </select>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                            <label className="block text-xs text-slate-400 mb-1">
                              Trim Start (e.g. 00:00:02)
                            </label>
                            <input
                              type="text"
                              placeholder="00:00:00"
                              value={item.advanced.trimStart}
                              onChange={(e) =>
                                updateAdvanced(item.id, "trimStart", e.target.value)
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100"
                            />
                          </div>

                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                            <label className="block text-xs text-slate-400 mb-1">
                              Trim End (e.g. 00:00:15)
                            </label>
                            <input
                              type="text"
                              placeholder="End of file"
                              value={item.advanced.trimEnd}
                              onChange={(e) =>
                                updateAdvanced(item.id, "trimEnd", e.target.value)
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress Bar & Status Message */}
                  {(item.status === "converting" || item.status === "done") && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`flex items-center gap-1.5 font-medium ${
                            item.status === "done"
                              ? "text-emerald-400"
                              : "text-indigo-300"
                          }`}
                        >
                          {item.status === "done" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          )}
                          {item.statusMessage}
                        </span>
                        <span className="font-mono font-semibold text-slate-300">
                          {item.progress}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            item.status === "done"
                              ? "bg-emerald-500"
                              : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {item.status === "error" && item.errorMessage && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{item.errorMessage}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
