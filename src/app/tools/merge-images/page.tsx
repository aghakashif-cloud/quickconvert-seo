"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone, type FileRejection } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import {
  Images,
  FileImage,
  FileText,
  Upload,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Plus,
} from "lucide-react";

interface ImageQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

interface MergeOutput {
  format: "jpg" | "pdf";
  url: string;
  size: number;
  filename: string;
  details: string;
}

const RECOMMENDED_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CANVAS_DIM = 16000;
const MAX_CANVAS_AREA = 64_000_000;

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not decode one of the uploaded image files."));
    img.src = src;
  });
}

async function rasterizeImageToPngBytes(
  img: HTMLImageElement
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize browser Canvas 2D context.");
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image for PDF."))),
      "image/png"
    );
  });

  return new Uint8Array(await blob.arrayBuffer());
}

export default function MergeImagesPage() {
  const [imageItems, setImageItems] = useState<ImageQueueItem[]>([]);
  const [outputFilename, setOutputFilename] = useState<string>("merged-images");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [processingMode, setProcessingMode] = useState<"jpg" | "pdf" | null>(
    null
  );
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MergeOutput | null>(null);

  const itemsRef = useRef<ImageQueueItem[]>([]);
  itemsRef.current = imageItems;

  // Cleanup preview and output blob URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  const clearResult = useCallback(() => {
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      setErrorMessage(null);

      if (rejections.length > 0 && acceptedFiles.length === 0) {
        setErrorMessage(
          "Please upload valid image files (JPG, PNG, or WebP)."
        );
        return;
      }

      const validImages = acceptedFiles.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        return (
          f.type.startsWith("image/") ||
          ["jpg", "jpeg", "png", "webp"].includes(ext)
        );
      });

      if (validImages.length === 0) {
        setErrorMessage(
          "Please upload valid image files (JPG, PNG, or WebP)."
        );
        return;
      }

      clearResult();

      const prepared: ImageQueueItem[] = [];
      for (const file of validImages) {
        const previewUrl = URL.createObjectURL(file);
        try {
          const img = await loadImageElement(previewUrl);
          prepared.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            previewUrl,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
        } catch {
          URL.revokeObjectURL(previewUrl);
        }
      }

      if (prepared.length === 0) {
        setErrorMessage(
          "Could not decode the selected images. Please try JPG, PNG, or WebP files."
        );
        return;
      }

      setImageItems((prev) => [...prev, ...prepared]);
    },
    [clearResult]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
  });

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= imageItems.length) return;
    clearResult();
    setImageItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const removeItem = (id: string) => {
    clearResult();
    setErrorMessage(null);
    setImageItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = () => {
    if (processingMode) return;
    clearResult();
    imageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setImageItems([]);
    setProgress(0);
    setStatusText("");
    setErrorMessage(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    clearResult();
    setImageItems((prev) => {
      const copy = [...prev];
      const [dragged] = copy.splice(draggedIndex, 1);
      copy.splice(index, 0, dragged);
      return copy;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getCleanBaseFilename = () =>
    outputFilename
      .trim()
      .replace(/\.(jpg|jpeg|pdf)$/i, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim() || "merged-images";

  // 1. Merge Images into a Single Long JPG (Canvas API)
  const handleMergeToJpg = async () => {
    if (processingMode) return;
    if (imageItems.length < 2) {
      setErrorMessage(
        "Please add at least 2 images to merge them into a single JPG."
      );
      return;
    }

    setProcessingMode("jpg");
    setErrorMessage(null);
    clearResult();
    setProgress(8);
    setStatusText("Loading image dimensions locally...");

    try {
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < imageItems.length; i++) {
        setProgress(Math.round(10 + (i / imageItems.length) * 35));
        setStatusText(
          `Loading image ${i + 1} of ${imageItems.length}: ${imageItems[i].file.name}...`
        );
        const img = await loadImageElement(imageItems[i].previewUrl);
        loadedImages.push(img);
      }

      const rawMaxWidth = Math.max(
        ...loadedImages.map((img) => img.naturalWidth || img.width)
      );
      const rawTotalHeight = loadedImages.reduce(
        (sum, img) => sum + (img.naturalHeight || img.height),
        0
      );

      // Keep canvas safely inside browser dimension & pixel area limits
      let scale = 1;
      if (rawMaxWidth > MAX_CANVAS_DIM) {
        scale = Math.min(scale, MAX_CANVAS_DIM / rawMaxWidth);
      }
      if (rawTotalHeight > MAX_CANVAS_DIM) {
        scale = Math.min(scale, MAX_CANVAS_DIM / rawTotalHeight);
      }
      if (rawMaxWidth * rawTotalHeight * scale * scale > MAX_CANVAS_AREA) {
        scale = Math.min(
          scale,
          Math.sqrt(MAX_CANVAS_AREA / (rawMaxWidth * rawTotalHeight))
        );
      }

      const finalWidth = Math.max(1, Math.round(rawMaxWidth * scale));
      const finalHeight = Math.max(1, Math.round(rawTotalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(
          "Could not allocate browser Canvas memory. Try merging fewer or smaller images."
        );
      }

      // White background so transparent PNGs render cleanly in JPG format
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, finalWidth, finalHeight);

      let cursorY = 0;
      for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        const drawW = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const drawH = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const offsetX = Math.round((finalWidth - drawW) / 2);

        setProgress(Math.round(50 + ((i + 1) / loadedImages.length) * 35));
        setStatusText(
          `Drawing image ${i + 1} of ${loadedImages.length} onto canvas...`
        );

        ctx.drawImage(img, offsetX, cursorY, drawW, drawH);
        cursorY += drawH;
      }

      setProgress(90);
      setStatusText("Encoding merged JPG image locally...");

      const jpgBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  new Error(
                    "Canvas export failed. Try fewer or smaller images so browser memory is not exceeded."
                  )
                ),
          "image/jpeg",
          0.92
        );
      });

      const url = URL.createObjectURL(jpgBlob);
      const filename = `${getCleanBaseFilename()}.jpg`;

      setProgress(100);
      setStatusText("Merged JPG created 100% locally in your browser!");
      setResult({
        format: "jpg",
        url,
        size: jpgBlob.size,
        filename,
        details: `${imageItems.length} images stitched vertically • ${finalWidth} × ${finalHeight} px${
          scale < 1 ? " (auto-scaled to fit browser canvas limit)" : ""
        }`,
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to merge images into a JPG file."
      );
      setProgress(0);
      setStatusText("");
    } finally {
      setProcessingMode(null);
    }
  };

  // 2. Merge Images into a Multi-Page PDF (pdf-lib)
  const handleMergeToPdf = async () => {
    if (processingMode) return;
    if (imageItems.length === 0) {
      setErrorMessage("Please add at least 1 image to create a PDF.");
      return;
    }

    setProcessingMode("pdf");
    setErrorMessage(null);
    clearResult();
    setProgress(8);
    setStatusText("Creating new PDF document locally with pdf-lib...");

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        setProgress(Math.round(12 + (i / imageItems.length) * 74));
        setStatusText(
          `Embedding image ${i + 1} of ${imageItems.length}: ${item.file.name}...`
        );

        const rawBytes = new Uint8Array(await item.file.arrayBuffer());
        const mime = item.file.type.toLowerCase();
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "";

        let embeddedImg;
        try {
          if (mime === "image/jpeg" || ext === "jpg" || ext === "jpeg") {
            embeddedImg = await pdfDoc.embedJpg(rawBytes);
          } else if (mime === "image/png" || ext === "png") {
            embeddedImg = await pdfDoc.embedPng(rawBytes);
          } else {
            // Convert WebP or other formats via offscreen Canvas to PNG before embedding
            const htmlImg = await loadImageElement(item.previewUrl);
            const pngBytes = await rasterizeImageToPngBytes(htmlImg);
            embeddedImg = await pdfDoc.embedPng(pngBytes);
          }
        } catch {
          // Safe fallback: re-encode through Canvas to clean PNG if source file header is non-standard
          const htmlImg = await loadImageElement(item.previewUrl);
          const pngBytes = await rasterizeImageToPngBytes(htmlImg);
          embeddedImg = await pdfDoc.embedPng(pngBytes);
        }

        const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height,
        });
      }

      setProgress(92);
      setStatusText(`Saving ${imageItems.length}-page PDF document...`);

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(pdfBlob);
      const filename = `${getCleanBaseFilename()}.pdf`;

      setProgress(100);
      setStatusText("Merged PDF created 100% locally in your browser!");
      setResult({
        format: "pdf",
        url,
        size: pdfBlob.size,
        filename,
        details: `${imageItems.length} ${
          imageItems.length === 1 ? "page" : "pages"
        } combined into one PDF document`,
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to merge images into a PDF document."
      );
      setProgress(0);
      setStatusText("");
    } finally {
      setProcessingMode(null);
    }
  };

  const isBusy = processingMode !== null;
  const totalSize = imageItems.reduce((sum, item) => sum + item.file.size, 0);
  const hasLargeImage = imageItems.some(
    (item) => item.file.size > RECOMMENDED_MAX_IMAGE_SIZE
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Images className="w-4 h-4" />
              Image &amp; PDF Studio • HTML5 Canvas + pdf-lib
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Merge Images to JPG or PDF
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Combine multiple JPG, PNG, or WebP images into a single vertical JPG or a multi-page PDF document 100% locally inside your browser—free and private.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/merge-pdf"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Merge PDF
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              File Converter
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

        {/* Privacy Notice + Required Performance Warning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-emerald-300">
              100% Private: Zero server uploads. Your photos and screenshots are merged strictly inside your browser.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-200">
              For best performance, upload images smaller than 5MB each. Merging many high-resolution images may slow down your browser.
            </p>
          </div>
        </div>

        {/* Multi-Image Drag-and-Drop Zone */}
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 md:p-12 text-center ${
            isDragActive
              ? "border-emerald-400 bg-emerald-500/10 scale-[0.995]"
              : "border-slate-700/80 hover:border-emerald-500/70 bg-slate-900/50 hover:bg-slate-900/80"
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-slate-100">
            {isDragActive
              ? "Drop your images here..."
              : imageItems.length > 0
              ? "Drag & Drop More Images to Append"
              : "Drag & Drop Multiple Images Here"}
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xl mx-auto">
            Supports <strong className="text-slate-300">JPG, PNG, and WebP</strong>. Reorder thumbnails with Move Up / Move Down or drag-and-drop, then export as one JPG or multi-page PDF.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-emerald-600/20 transition">
              <Plus className="w-4 h-4" />
              {imageItems.length > 0 ? "Add More Images" : "Select Images"}
            </span>
          </div>
        </div>

        {/* Uploaded Images List & Action Buttons */}
        {imageItems.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Toolbar */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <Images className="w-4 h-4 text-emerald-400" />
                  Image Order ({imageItems.length}{" "}
                  {imageItems.length === 1 ? "image" : "images"})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total size: {formatBytes(totalSize)} • Top-to-bottom merge order
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={open}
                  disabled={isBusy}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isBusy}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>

                <button
                  type="button"
                  onClick={handleMergeToJpg}
                  disabled={isBusy || imageItems.length < 2}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
                >
                  {processingMode === "jpg" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging JPG...
                    </>
                  ) : (
                    <>
                      <FileImage className="w-4 h-4" />
                      Merge into JPG
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleMergeToPdf}
                  disabled={isBusy}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {processingMode === "pdf" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Merge into PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output Filename Bar */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <label
                  htmlFor="merged-images-filename"
                  className="text-xs font-semibold text-slate-400 shrink-0"
                >
                  Output filename:
                </label>
                <input
                  id="merged-images-filename"
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  disabled={isBusy}
                  placeholder="merged-images"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-medium text-slate-100 disabled:opacity-50 w-48"
                />
              </div>
              {hasLargeImage && (
                <span className="text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  One or more images exceed 5 MB — merging may take a few extra seconds.
                </span>
              )}
            </div>

            {/* Thumbnail Queue Rows */}
            <div className="divide-y divide-slate-800/80">
              {imageItems.map((item, idx) => {
                const isOver5MB = item.file.size > RECOMMENDED_MAX_IMAGE_SIZE;
                return (
                  <div
                    key={item.id}
                    draggable={!isBusy}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition ${
                      draggedIndex === idx
                        ? "bg-emerald-500/10"
                        : "hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        title="Drag to reorder"
                        className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Image Thumbnail */}
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs md:text-sm font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-md">
                            {item.file.name}
                          </p>
                          {isOver5MB && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              &gt; 5 MB
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {formatBytes(item.file.size)} • {item.width} ×{" "}
                          {item.height} px
                        </p>
                      </div>
                    </div>

                    {/* Move Up, Move Down & Remove */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => moveItem(idx, -1)}
                        disabled={isBusy || idx === 0}
                        title="Move Up"
                        aria-label={`Move ${item.file.name} up`}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-700/80 transition flex items-center gap-1 text-xs font-medium"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Move Up</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 1)}
                        disabled={isBusy || idx === imageItems.length - 1}
                        title="Move Down"
                        aria-label={`Move ${item.file.name} down`}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-700/80 transition flex items-center gap-1 text-xs font-medium"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Move Down</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isBusy}
                        title="Remove image"
                        aria-label={`Remove ${item.file.name}`}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 disabled:opacity-30 border border-slate-700/80 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            {(isBusy || progress > 0) && (
              <div className="px-5 py-4 bg-slate-950/90 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2 truncate">
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">{statusText}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-300 shrink-0 ml-2">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      progress >= 100
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-emerald-500 to-indigo-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Download Result Card */}
        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Your Merged {result.format.toUpperCase()} Is Ready!
                  </h3>
                  <p className="text-xs md:text-sm text-emerald-200/90 mt-0.5">
                    {result.details} • {formatBytes(result.size)} —{" "}
                    {result.filename}
                  </p>
                </div>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                Download Merged {result.format.toUpperCase()}
              </a>
            </div>

            {result.format === "jpg" && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 max-h-96 overflow-y-auto flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.url}
                  alt="Merged vertical JPG preview"
                  className="max-w-full h-auto rounded-lg"
                />
              </div>
            )}
          </div>
        )}

        {/* SEO Content Section */}
        <ToolSeoContent
          toolName="Merge Images to JPG or PDF Tool"
          aboutParagraphs={[
            "Our free Merge Images tool lets you combine multiple JPG, PNG, and WebP photos or screenshots into either a single continuous vertical JPG image or a crisp multi-page PDF document right inside your web browser. Using the native HTML5 Canvas API for seamless vertical image stitching and pdf-lib for client-side PDF generation, your private photos, scanned IDs, receipts, and chat screenshots never leave your device.",
            "Whether you are combining long mobile screenshots for a tutorial, stitching product photos into a single shareable graphic, or turning multi-page document scans into a neat PDF for email or portal submission, you can preview every thumbnail, reorder images in seconds, and export cleanly with zero watermarks or upload delays.",
          ]}
          howToSteps={[
            {
              title: "Upload Your Images",
              detail:
                "Drag and drop multiple JPG, PNG, or WebP files into the dropzone above to view thumbnails, dimensions, and sizes immediately.",
            },
            {
              title: "Arrange the Exact Order",
              detail:
                "Click Move Up / Move Down or drag any row by its handle to arrange your images from top to bottom (or page 1 to last page).",
            },
            {
              title: "Choose JPG or PDF & Download",
              detail:
                "Click Merge into JPG for one stitched vertical image, or Merge into PDF for a multi-page PDF document, then download instantly.",
            },
          ]}
          highlights={[
            "100% private client-side merging via HTML5 Canvas and pdf-lib—zero server uploads and instant local processing.",
            "Supports JPG, PNG (with clean white backdrop for JPG export), and WebP images seamlessly.",
            "Visual thumbnail list with pixel dimensions, Move Up / Move Down buttons, and drag-and-drop reordering.",
            "Free unlimited merging with no signup, no watermarks, and custom output filenames.",
          ]}
        />
      </div>
    </div>
  );
}
