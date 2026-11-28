"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone } from "react-dropzone";
import {
  Eraser,
  Upload,
  Sparkles,
  Download,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  Image as ImageIcon,
  Palette,
  Eye,
  BookOpen,
  Check,
  ImagePlus,
} from "lucide-react";

type BgMode = "transparent" | "solid" | "gradient" | "custom-color" | "custom-image";
type ExportFormat = "png" | "jpg";

interface GradientPreset {
  id: string;
  label: string;
  css: string;
  stops: [string, string, string?];
  angleDeg: number;
}

// Self-hosted IMG.LY v1.7.0 model & WASM directory inside public/models/
const LOCAL_MODELS_PATH = "/models/";

const SOLID_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "blue", label: "Blue", hex: "#2563eb" },
  { id: "red", label: "Red", hex: "#dc2626" },
  { id: "black", label: "Black", hex: "#000000" },
  { id: "emerald", label: "Emerald", hex: "#059669" },
  { id: "slate", label: "Studio Gray", hex: "#1e293b" },
];

const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "sunset",
    label: "Sunset",
    css: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #6366f1 100%)",
    stops: ["#f97316", "#ec4899", "#6366f1"],
    angleDeg: 135,
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(135deg, #06b6d4 0%, #2563eb 55%, #0f172a 100%)",
    stops: ["#06b6d4", "#2563eb", "#0f172a"],
    angleDeg: 135,
  },
  {
    id: "purple",
    label: "Purple",
    css: "linear-gradient(135deg, #4f46e5 0%, #9333ea 55%, #ec4899 100%)",
    stops: ["#4f46e5", "#9333ea", "#ec4899"],
    angleDeg: 135,
  },
  {
    id: "mint",
    label: "Mint Studio",
    css: "linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)",
    stops: ["#10b981", "#0ea5e9"],
    angleDeg: 135,
  },
  {
    id: "midnight",
    label: "Midnight Pro",
    css: "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #020617 100%)",
    stops: ["#0f172a", "#312e81", "#020617"],
    angleDeg: 135,
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image into canvas."));
    img.src = src;
  });
}

export default function BackgroundRemoverPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(
    null
  );

  // Processing state
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Background replacement controls
  const [bgMode, setBgMode] = useState<BgMode>("transparent");
  const [selectedSolid, setSelectedSolid] = useState<string>("#ffffff");
  const [selectedGradient, setSelectedGradient] = useState<GradientPreset>(
    GRADIENT_PRESETS[0]
  );
  const [customColor, setCustomColor] = useState<string>("#6366f1");
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgName, setCustomBgName] = useState<string>("");

  // Preview / Export options
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState<boolean>(false);

  const bgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    };
  }, [cutoutUrl]);

  useEffect(() => {
    return () => {
      if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    };
  }, [customBgUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);

      const url = URL.createObjectURL(file);
      setSourceFile(file);
      setSourceUrl(url);
      setCutoutUrl(null);
      setDimensions(null);
      setBgMode("transparent");
      setShowOriginal(false);
      setProgressPct(0);
      setError(null);
      setStatusMessage("Image loaded locally. Click Remove Background to start.");

      const probe = new window.Image();
      probe.onload = () => {
        setDimensions({ w: probe.naturalWidth, h: probe.naturalHeight });
      };
      probe.src = url;
    },
    [sourceUrl, cutoutUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: processing,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
    },
  });

  const handleRemoveBackground = async () => {
    if (!sourceFile || processing) return;

    setProcessing(true);
    setError(null);
    setProgressPct(8);
    setStatusMessage(
      "Loading AI segmentation model locally (first run may take 10–15 seconds)..."
    );

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      // Resolve absolute URL from current origin so `new URL("resources.json", publicPath)` succeeds
      const publicPath = `${window.location.origin}${LOCAL_MODELS_PATH}`;

      const config: NonNullable<Parameters<typeof removeBackground>[1]> = {
        publicPath,
        debug: true, // Keep true to inspect detailed IMG.LY & ONNX logs in browser console
        model: "isnet_quint8",
        device: "cpu",
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(
              96,
              Math.max(10, Math.round((current / total) * 100))
            );
            setProgressPct(pct);
            if (key.toLowerCase().includes("fetch")) {
              setStatusMessage(
                `Loading local AI model into browser cache (${pct}%)...`
              );
            } else {
              setStatusMessage(`Removing image background locally (${pct}%)...`);
            }
          }
        },
      };

      const resultBlob = await removeBackground(sourceFile, config);

      const outUrl = URL.createObjectURL(resultBlob);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
      setCutoutUrl(outUrl);
      setProgressPct(100);
      setShowOriginal(false);
      setStatusMessage(
        "Background removed 100% locally! Choose a color, gradient, or custom photo below and download."
      );
    } catch (err: unknown) {
      console.error("[BackgroundRemover] removeBackground error:", err);
      const rawMessage = err instanceof Error ? err.message : String(err || "");
      const isNetworkOrCorsError =
        /failed to fetch|networkerror|network request|cors|err_blocked|resource metadata|fetch/i.test(
          rawMessage
        );

      setError(
        isNetworkOrCorsError
          ? `Failed to load AI model. Please check your internet connection or try again later. (${rawMessage})`
          : rawMessage ||
              "Failed to remove image background in browser. Please try a JPG or PNG under 10MB."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    const url = URL.createObjectURL(file);
    setCustomBgUrl(url);
    setCustomBgName(file.name);
    setBgMode("custom-image");
    setShowOriginal(false);
  };

  /**
   * Composites the transparent cutout on top of the chosen solid color, gradient,
   * or uploaded background image using an offscreen HTML5 <canvas>, then downloads PNG or JPG.
   */
  const handleDownloadComposite = async () => {
    if (!cutoutUrl || exporting) return;

    setExporting(true);
    setError(null);

    try {
      const fgImg = await loadImageElement(cutoutUrl);
      const width = fgImg.naturalWidth || dimensions?.w || 1024;
      const height = fgImg.naturalHeight || dimensions?.h || 1024;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Browser could not initialize HTML5 Canvas.");

      // Step 1: Paint background layer
      if (bgMode === "transparent") {
        if (exportFormat === "jpg") {
          // JPG does not support transparency — fill clean white automatically
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }
      } else if (bgMode === "solid") {
        ctx.fillStyle = selectedSolid;
        ctx.fillRect(0, 0, width, height);
      } else if (bgMode === "custom-color") {
        ctx.fillStyle = customColor;
        ctx.fillRect(0, 0, width, height);
      } else if (bgMode === "gradient") {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        const [c1, c2, c3] = selectedGradient.stops;
        grad.addColorStop(0, c1);
        if (c3) {
          grad.addColorStop(0.5, c2);
          grad.addColorStop(1, c3);
        } else {
          grad.addColorStop(1, c2);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (bgMode === "custom-image" && customBgUrl) {
        const bgImg = await loadImageElement(customBgUrl);
        // Center-crop (object-cover) background image so it fills cleanly without distortion
        const bgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;
        let offsetX = 0;
        let offsetY = 0;

        if (bgAspect > canvasAspect) {
          drawH = height;
          drawW = drawH * bgAspect;
          offsetX = (width - drawW) / 2;
        } else {
          drawW = width;
          drawH = drawW / bgAspect;
          offsetY = (height - drawH) / 2;
        }
        ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
      }

      // Step 2: Draw transparent AI cutout cleanly on top
      ctx.drawImage(fgImg, 0, 0, width, height);

      const mimeType = exportFormat === "jpg" ? "image/jpeg" : "image/png";
      const quality = exportFormat === "jpg" ? 0.92 : undefined;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), mimeType, quality)
      );

      if (!blob) throw new Error("Failed to export canvas image.");

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseName = (sourceFile?.name || "image").replace(/\.[^.]+$/, "");
      a.href = downloadUrl;
      a.download = `${baseName}-nobg.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate composite download."
      );
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    setSourceFile(null);
    setSourceUrl(null);
    setCutoutUrl(null);
    setCustomBgUrl(null);
    setCustomBgName("");
    setDimensions(null);
    setBgMode("transparent");
    setShowOriginal(false);
    setProgressPct(0);
    setError(null);
    setStatusMessage("");
  };

  // Dynamic preview backdrop style
  const getPreviewBackdropStyle = (): React.CSSProperties => {
    if (showOriginal || !cutoutUrl) {
      return { backgroundColor: "#020617" };
    }
    if (bgMode === "transparent") {
      return {
        backgroundColor: "#0f172a",
        backgroundImage:
          "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
      };
    }
    if (bgMode === "solid") {
      return { backgroundColor: selectedSolid };
    }
    if (bgMode === "custom-color") {
      return { backgroundColor: customColor };
    }
    if (bgMode === "gradient") {
      return { backgroundImage: selectedGradient.css };
    }
    if (bgMode === "custom-image" && customBgUrl) {
      return {
        backgroundImage: `url(${customBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: "#0f172a" };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <BackButton />

        {/* Hero Header */}
        <div className="bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-emerald-500/10 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <Eraser className="w-3.5 h-3.5" />
              AI Background Remover
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Local Browser AI — Zero Uploads
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Free AI Image Background Remover
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed">
            Instantly cut out people, products, logos, and pets directly inside
            your browser with zero Photoshop skills and zero cloud uploads.
            Preview transparency on a crisp checkerboard, swap in solid colors,
            studio gradients, or your own background photo, and export HD PNG or
            JPG.
          </p>
        </div>

        {/* Required First-Time Model Loading Warning Banner */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs md:text-sm leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-amber-100">Privacy &amp; Speed Note: </strong>
            Processing happens locally in your browser. First-time use may take
            10-15 seconds to load the AI model.
          </p>
        </div>

        {/* Main Workspace Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl shadow-black/25">
          {!sourceFile ? (
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
                  ? "Drop your image here"
                  : "Drag & Drop Any Photo to Remove Background"}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mb-4">
                Supports PNG, JPG, JPEG, WebP &amp; BMP — portraits, e-commerce
                products, headshots, and logos
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25">
                <ImageIcon className="w-4 h-4" />
                Select Image File
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {sourceFile.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(sourceFile.size)}
                      {dimensions ? ` • ${dimensions.w} × ${dimensions.h} px` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {cutoutUrl && (
                    <button
                      type="button"
                      onClick={() => setShowOriginal((prev) => !prev)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      {showOriginal ? "View Cutout" : "View Original"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={processing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    New Image
                  </button>
                </div>
              </div>

              {/* Preview Area (Checkerboard pattern for transparency + live background composite) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {!cutoutUrl
                      ? "Original Image Preview"
                      : showOriginal
                      ? "Showing Original Photo"
                      : bgMode === "transparent"
                      ? "Transparent Cutout Preview (Checkerboard = Clear Alpha)"
                      : "Live Replaced Background Preview"}
                  </span>
                  {cutoutUrl && (
                    <span className="text-emerald-400 font-semibold">
                      AI Cutout Ready
                    </span>
                  )}
                </div>

                <div
                  className="relative w-full min-h-[300px] max-h-[480px] rounded-2xl border border-slate-700/80 overflow-hidden flex items-center justify-center p-4"
                  style={getPreviewBackdropStyle()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      showOriginal || !cutoutUrl
                        ? sourceUrl || ""
                        : cutoutUrl
                    }
                    alt="Background removal preview"
                    className="max-h-[440px] max-w-full object-contain rounded-lg"
                  />

                  {processing && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                      <div className="w-full max-w-sm space-y-2">
                        <p className="text-sm font-bold text-white">
                          {statusMessage}
                        </p>
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${Math.max(8, progressPct)}%` }}
                          />
                        </div>
                        <p className="text-xs font-mono text-indigo-300">
                          {progressPct}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Remove Background CTA (shown before cutout completes) */}
              {!cutoutUrl && (
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={processing}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:via-purple-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-sm md:text-base transition flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Removing Background Locally ({progressPct}%)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Remove Background
                    </>
                  )}
                </button>
              )}

              {/* Background Replacement Studio (shown once background is removed) */}
              {cutoutUrl && (
                <div className="space-y-6 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                      <Palette className="w-5 h-5 text-indigo-400" />
                      Background Replacement Options
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setBgMode("transparent");
                        setShowOriginal(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        bgMode === "transparent"
                          ? "bg-indigo-600/25 border-indigo-400 text-indigo-200"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Transparent (No BG)
                    </button>
                  </div>

                  {/* 1. Solid Colors */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Solid Colors
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {SOLID_COLORS.map((color) => {
                        const active =
                          bgMode === "solid" && selectedSolid === color.hex;
                        return (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => {
                              setSelectedSolid(color.hex);
                              setBgMode("solid");
                              setShowOriginal(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                              active
                                ? "bg-indigo-500/20 border-indigo-400 text-white"
                                : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600"
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-slate-600 shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: color.hex }}
                            >
                              {active && (
                                <Check
                                  className={`w-3 h-3 ${
                                    color.hex === "#ffffff"
                                      ? "text-slate-900"
                                      : "text-white"
                                  }`}
                                />
                              )}
                            </span>
                            <span>{color.label}</span>
                          </button>
                        );
                      })}

                      {/* Custom Color Picker */}
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          bgMode === "custom-color"
                            ? "bg-indigo-500/20 border-indigo-400 text-white"
                            : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => {
                            setCustomColor(e.target.value);
                            setBgMode("custom-color");
                            setShowOriginal(false);
                          }}
                          className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                        />
                        <span>Custom ({customColor.toUpperCase()})</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Gradients */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Studio Gradients
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                      {GRADIENT_PRESETS.map((grad) => {
                        const active =
                          bgMode === "gradient" &&
                          selectedGradient.id === grad.id;
                        return (
                          <button
                            key={grad.id}
                            type="button"
                            onClick={() => {
                              setSelectedGradient(grad);
                              setBgMode("gradient");
                              setShowOriginal(false);
                            }}
                            className={`group rounded-xl p-1.5 border transition text-left ${
                              active
                                ? "border-indigo-400 bg-indigo-500/15"
                                : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                            }`}
                          >
                            <div
                              className="w-full h-10 rounded-lg mb-1.5 flex items-center justify-center"
                              style={{ backgroundImage: grad.css }}
                            >
                              {active && (
                                <Check className="w-4 h-4 text-white drop-shadow" />
                              )}
                            </div>
                            <span className="block text-[11px] font-semibold text-slate-200 px-1 truncate">
                              {grad.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Custom Background Image Upload */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Custom Background Photo (Optional)
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={bgInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCustomBgUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => bgInputRef.current?.click()}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
                          bgMode === "custom-image"
                            ? "bg-indigo-600/25 border-indigo-400 text-indigo-200"
                            : "bg-slate-950/80 border-slate-700 hover:border-indigo-500/60 text-slate-200"
                        }`}
                      >
                        <ImagePlus className="w-4 h-4 text-indigo-400" />
                        {customBgName
                          ? `Background: ${customBgName}`
                          : "Upload Custom Background Image"}
                      </button>

                      {customBgUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (customBgUrl) URL.revokeObjectURL(customBgUrl);
                            setCustomBgUrl(null);
                            setCustomBgName("");
                            if (bgMode === "custom-image")
                              setBgMode("transparent");
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                        >
                          Remove Custom BG
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Download Bar (Format Selector + HTML5 Canvas Export) */}
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        Export Format:
                      </span>
                      <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-1">
                        <button
                          type="button"
                          onClick={() => setExportFormat("png")}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                            exportFormat === "png"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          PNG (Transparent / HD)
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat("jpg")}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                            exportFormat === "jpg"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          JPG (Compact)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadComposite}
                      disabled={exporting}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                    >
                      {exporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Exporting Canvas...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download {exportFormat.toUpperCase()} Image
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs md:text-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-300">Background Removal Error</p>
                  <p>{error}</p>
                </div>
              </div>
              {sourceFile && !processing && (
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  className="shrink-0 px-3.5 py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-100 text-xs font-bold transition"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Companion Tutorial Link Banner */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">
                Need Crisp Product Photos or YouTube Cutouts Without Photoshop?
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Read our tested guide on lighting, edge quality, and choosing
                transparent PNG vs. studio backgrounds.
              </p>
            </div>
          </div>
          <Link
            href="/blog/how-to-remove-image-background-for-free-without-photoshop"
            className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition"
          >
            Read Full Guide →
          </Link>
        </div>

        <ToolSeoContent
          toolName="Free AI Background Remover & Background Changer"
          aboutParagraphs={[
            "QuickConvert's Free AI Background Remover uses neural image segmentation running 100% locally inside your web browser to isolate subjects—portraits, e-commerce products, cars, pets, and brand logos—without uploading personal or commercial photos to remote cloud servers. There are no per-image credits, no low-resolution preview locks, and zero watermarks.",
            "Once your transparent cutout appears over our dark checkerboard preview, you can leave the background clear for a crisp transparent PNG or replace it instantly with solid studio colors (white, blue, red, black), multi-stop gradients (Sunset, Ocean, Purple), any custom hex color from the picker, or your own uploaded background photograph—composited at full resolution via HTML5 Canvas.",
          ]}
          howToSteps={[
            {
              title: "Upload Any Photo Locally",
              detail:
                "Drag and drop a PNG, JPG, or WebP photo into the browser. Your image never leaves your computer or smartphone.",
            },
            {
              title: "Click Remove Background",
              detail:
                "Our in-browser AI model isolates the foreground subject automatically and displays a crisp transparent cutout over a checkerboard grid.",
            },
            {
              title: "Customize Background & Download",
              detail:
                "Keep it transparent or apply solid colors, studio gradients, a custom color picker, or your own background photo, then export full-resolution PNG or JPG.",
            },
          ]}
          highlights={[
            "100% client-side AI background removal powered by WebAssembly & ONNX—zero photo uploads and total privacy.",
            "Instant background replacement with solid colors, multi-stop gradients, custom color picker, and custom photo uploads.",
            "Full-resolution HTML5 Canvas export in lossless transparent PNG or compact high-quality JPG with zero watermarks.",
            "Ideal for Shopify/Amazon white product listings, LinkedIn headshots, YouTube thumbnail cutouts, and passport photos.",
          ]}
        />
      </div>
    </div>
  );
}
