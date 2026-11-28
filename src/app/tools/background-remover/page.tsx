"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone } from "react-dropzone";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
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
  BookOpen,
  Check,
  ImagePlus,
  Layers,
  ArrowUp,
  ArrowDown,
  Move,
  PlusCircle,
  RotateCcw,
} from "lucide-react";

type BgMode =
  | "transparent"
  | "solid"
  | "gradient"
  | "custom-color"
  | "custom-image";
type ExportFormat = "png" | "jpg";

interface GradientPreset {
  id: string;
  label: string;
  css: string;
  stops: [string, string, string?];
}

// Self-hosted IMG.LY v1.7.0 model & WASM directory inside public/models/
const LOCAL_MODELS_PATH = "/models/";
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

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
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(135deg, #06b6d4 0%, #2563eb 55%, #0f172a 100%)",
    stops: ["#06b6d4", "#2563eb", "#0f172a"],
  },
  {
    id: "purple",
    label: "Purple",
    css: "linear-gradient(135deg, #4f46e5 0%, #9333ea 55%, #ec4899 100%)",
    stops: ["#4f46e5", "#9333ea", "#ec4899"],
  },
  {
    id: "mint",
    label: "Mint Studio",
    css: "linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)",
    stops: ["#10b981", "#0ea5e9"],
  },
  {
    id: "midnight",
    label: "Midnight Pro",
    css: "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #020617 100%)",
    stops: ["#0f172a", "#312e81", "#020617"],
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function BackgroundRemoverPhotoEditorPage() {
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

  // Interactive Fabric.js Photo Editor state
  const [bgMode, setBgMode] = useState<BgMode>("transparent");
  const [selectedSolid, setSelectedSolid] = useState<string>("#ffffff");
  const [selectedGradient, setSelectedGradient] = useState<GradientPreset>(
    GRADIENT_PRESETS[0]
  );
  const [customColor, setCustomColor] = useState<string>("#6366f1");
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgName, setCustomBgName] = useState<string>("");

  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [layerCount, setLayerCount] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState<boolean>(false);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraObjectUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount
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

  useEffect(() => {
    const urls = extraObjectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  /**
   * Syncs CSS display dimensions of the Fabric.js canvas to fit the responsive container
   * while keeping internal logical coordinates fixed at 800x600 for crisp exports & exact pointer mapping.
   */
  const syncResponsiveCanvasSize = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!canvas || !wrapper) return;

    const availableWidth = Math.max(260, wrapper.clientWidth - 2);
    const displayW = Math.min(CANVAS_WIDTH, availableWidth);
    const displayH = Math.round((displayW * CANVAS_HEIGHT) / CANVAS_WIDTH);
    canvas.setDimensions(
      { width: displayW, height: displayH },
      { cssOnly: true }
    );
  }, []);

  /**
   * Initializes the interactive 800x600 Fabric.js canvas once the transparent cutout is ready.
   */
  useEffect(() => {
    if (!cutoutUrl || !canvasElRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const initFabricEditor = async () => {
      const fabric = await import("fabric");
      if (cancelled || !canvasElRef.current) return;

      // Dispose any existing canvas instance cleanly
      if (fabricCanvasRef.current) {
        await fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        preserveObjectStacking: true,
        selection: true,
      });

      fabricCanvasRef.current = canvas;

      // Track selection state for layer buttons
      const updateSelectionState = () => {
        setHasSelection(Boolean(canvas.getActiveObject()));
        setLayerCount(canvas.getObjects().length);
      };

      canvas.on("selection:created", updateSelectionState);
      canvas.on("selection:updated", updateSelectionState);
      canvas.on("selection:cleared", updateSelectionState);
      canvas.on("object:added", updateSelectionState);
      canvas.on("object:removed", updateSelectionState);

      // Load the transparent cutout subject onto the canvas as an interactive object
      const subjectImg = await fabric.FabricImage.fromURL(cutoutUrl, {
        crossOrigin: "anonymous",
      });

      if (cancelled) {
        await canvas.dispose();
        return;
      }

      const imgW = subjectImg.width || 600;
      const imgH = subjectImg.height || 600;
      const fitScale = Math.min(
        (CANVAS_WIDTH * 0.78) / imgW,
        (CANVAS_HEIGHT * 0.82) / imgH,
        1
      );

      subjectImg.set({
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        originX: "center",
        originY: "center",
        scaleX: fitScale,
        scaleY: fitScale,
        cornerColor: "#ffffff",
        cornerStrokeColor: "#6366f1",
        borderColor: "#6366f1",
        cornerStyle: "circle",
        cornerSize: 12,
        transparentCorners: false,
        padding: 6,
      });

      canvas.add(subjectImg);
      canvas.setActiveObject(subjectImg);
      canvas.requestRenderAll();
      updateSelectionState();

      syncResponsiveCanvasSize();
      if (canvasWrapperRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          syncResponsiveCanvasSize();
        });
        resizeObserver.observe(canvasWrapperRef.current);
      }
    };

    initFabricEditor().catch((err) => {
      console.error("[PhotoEditor] Failed to initialize Fabric canvas:", err);
      setError("Failed to initialize interactive canvas editor.");
    });

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose().catch(() => {});
        fabricCanvasRef.current = null;
      }
    };
  }, [cutoutUrl, syncResponsiveCanvasSize]);

  /**
   * Apply background changes (Transparent, Solid Color, Gradient, Custom Color, Custom Photo)
   * directly onto the live Fabric.js canvas.
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !cutoutUrl) return;

    let cancelled = false;

    const applyCanvasBackground = async () => {
      const fabric = await import("fabric");
      if (cancelled || !fabricCanvasRef.current) return;

      if (bgMode === "transparent") {
        canvas.backgroundImage = undefined;
        canvas.backgroundColor = "";
        canvas.requestRenderAll();
      } else if (bgMode === "solid") {
        canvas.backgroundImage = undefined;
        canvas.backgroundColor = selectedSolid;
        canvas.requestRenderAll();
      } else if (bgMode === "custom-color") {
        canvas.backgroundImage = undefined;
        canvas.backgroundColor = customColor;
        canvas.requestRenderAll();
      } else if (bgMode === "gradient") {
        const [c1, c2, c3] = selectedGradient.stops;
        const colorStops = c3
          ? [
              { offset: 0, color: c1 },
              { offset: 0.5, color: c2 },
              { offset: 1, color: c3 },
            ]
          : [
              { offset: 0, color: c1 },
              { offset: 1, color: c2 },
            ];

        canvas.backgroundImage = undefined;
        canvas.backgroundColor = new fabric.Gradient({
          type: "linear",
          coords: { x1: 0, y1: 0, x2: CANVAS_WIDTH, y2: CANVAS_HEIGHT },
          colorStops,
        });
        canvas.requestRenderAll();
      } else if (bgMode === "custom-image" && customBgUrl) {
        const bgImg = await fabric.FabricImage.fromURL(customBgUrl, {
          crossOrigin: "anonymous",
        });
        if (cancelled || !fabricCanvasRef.current) return;

        const bgW = bgImg.width || CANVAS_WIDTH;
        const bgH = bgImg.height || CANVAS_HEIGHT;
        const coverScale = Math.max(CANVAS_WIDTH / bgW, CANVAS_HEIGHT / bgH);

        bgImg.set({
          scaleX: coverScale,
          scaleY: coverScale,
          originX: "center",
          originY: "center",
          left: CANVAS_WIDTH / 2,
          top: CANVAS_HEIGHT / 2,
        });

        canvas.backgroundColor = "";
        canvas.backgroundImage = bgImg;
        canvas.requestRenderAll();
      }
    };

    applyCanvasBackground().catch((err) => {
      console.error("[PhotoEditor] Background update error:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [
    bgMode,
    selectedSolid,
    selectedGradient,
    customColor,
    customBgUrl,
    cutoutUrl,
  ]);

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
      "Loading local AI segmentation model (first run may take 10–15 seconds)..."
    );

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      // Resolve absolute URL from current origin so `new URL("resources.json", publicPath)` succeeds
      const publicPath = `${window.location.origin}${LOCAL_MODELS_PATH}`;

      const config: NonNullable<Parameters<typeof removeBackground>[1]> = {
        publicPath,
        debug: true,
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
      setStatusMessage(
        "Background removed! Drag, resize, rotate, or add secondary images on the canvas."
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

  /**
   * Add a secondary interactive image layer (logo, product, sticker, second person) onto the Fabric.js canvas.
   */
  const handleAddSecondaryImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !fabricCanvasRef.current) return;

    try {
      const fabric = await import("fabric");
      const url = URL.createObjectURL(file);
      extraObjectUrlsRef.current.push(url);

      const newImg = await fabric.FabricImage.fromURL(url, {
        crossOrigin: "anonymous",
      });

      const canvas = fabricCanvasRef.current;
      const imgW = newImg.width || 300;
      const imgH = newImg.height || 300;
      const scale = Math.min(
        (CANVAS_WIDTH * 0.35) / imgW,
        (CANVAS_HEIGHT * 0.35) / imgH,
        1
      );

      // Slight offset per added layer so multiple elements stay clearly visible
      const offset = (canvas.getObjects().length % 5) * 24;

      newImg.set({
        left: CANVAS_WIDTH / 2 + 70 + offset,
        top: CANVAS_HEIGHT / 2 - 40 + offset,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        cornerColor: "#ffffff",
        cornerStrokeColor: "#10b981",
        borderColor: "#10b981",
        cornerStyle: "circle",
        cornerSize: 12,
        transparentCorners: false,
        padding: 6,
      });

      canvas.add(newImg);
      canvas.setActiveObject(newImg);
      canvas.requestRenderAll();
      setHasSelection(true);
      setLayerCount(canvas.getObjects().length);
    } catch (err) {
      console.error("[PhotoEditor] Failed to add secondary image:", err);
      setError("Could not load that secondary image onto the canvas.");
    }
  };

  const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    const url = URL.createObjectURL(file);
    setCustomBgUrl(url);
    setCustomBgName(file.name);
    setBgMode("custom-image");
  };

  // Z-Index Layer Controls
  const handleBringForward = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active: FabricObject | undefined = canvas.getActiveObject();
    if (!active) return;
    canvas.bringObjectForward(active);
    canvas.requestRenderAll();
  };

  const handleSendBackward = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active: FabricObject | undefined = canvas.getActiveObject();
    if (!active) return;
    canvas.sendObjectBackwards(active);
    canvas.requestRenderAll();
  };

  const handleDeleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setHasSelection(false);
    setLayerCount(canvas.getObjects().length);
  };

  /**
   * Exports the live Fabric.js canvas composition at 2x HD resolution (1600x1200)
   * as lossless PNG or compact JPG.
   */
  const handleDownloadFinalImage = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || exporting) return;

    setExporting(true);
    setError(null);

    try {
      canvas.discardActiveObject();

      const needsWhiteFallback =
        exportFormat === "jpg" && bgMode === "transparent";
      const prevBgColor = canvas.backgroundColor;

      if (needsWhiteFallback) {
        canvas.backgroundColor = "#ffffff";
      }

      canvas.renderAll();

      const dataUrl = canvas.toDataURL({
        format: exportFormat === "jpg" ? "jpeg" : "png",
        quality: exportFormat === "jpg" ? 0.94 : 1,
        multiplier: 2,
      });

      if (needsWhiteFallback) {
        canvas.backgroundColor = prevBgColor;
        canvas.requestRenderAll();
      }

      const a = document.createElement("a");
      const baseName = (sourceFile?.name || "composition").replace(/\.[^.]+$/, "");
      a.href = dataUrl;
      a.download = `${baseName}-edited.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      console.error("[PhotoEditor] Export error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to export the final image from the canvas."
      );
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose().catch(() => {});
      fabricCanvasRef.current = null;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    extraObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    extraObjectUrlsRef.current = [];

    setSourceFile(null);
    setSourceUrl(null);
    setCutoutUrl(null);
    setCustomBgUrl(null);
    setCustomBgName("");
    setDimensions(null);
    setBgMode("transparent");
    setHasSelection(false);
    setLayerCount(0);
    setProgressPct(0);
    setError(null);
    setStatusMessage("");
  };

  const checkerboardBgStyle: React.CSSProperties = {
    backgroundColor: "#0f172a",
    backgroundImage:
      "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
    backgroundSize: "24px 24px",
    backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <BackButton />

        {/* Hero Header */}
        <div className="bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-emerald-500/10 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <Eraser className="w-3.5 h-3.5" />
              AI Background Remover &amp; Photo Editor
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Local Browser AI — Zero Uploads
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Free AI Background Remover &amp; Interactive Photo Editor
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed">
            Remove photo backgrounds locally in seconds, then drag, scale, and
            rotate your subject on an interactive 800×600 canvas. Swap in solid
            colors, gradients, or custom background photos, layer logos or
            secondary images with Z-index controls, and export crisp HD PNG or
            JPG.
          </p>
        </div>

        {/* First-Time Model Loading Warning Banner */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs md:text-sm leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-amber-100">Privacy &amp; Speed Note: </strong>
            Processing happens locally in your browser. First-time use may take
            10-15 seconds to load the AI model.
          </p>
        </div>

        {/* STAGE 1: Upload & Remove Background (shown before interactive editor opens) */}
        {!cutoutUrl ? (
          <div className="max-w-5xl mx-auto bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl shadow-black/25">
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
                  Supports PNG, JPG, JPEG, WebP &amp; BMP — portraits, products,
                  headshots, and logos
                </p>
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25">
                  <ImageIcon className="w-4 h-4" />
                  Select Image File
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Loaded File Header */}
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
                        {dimensions
                          ? ` • ${dimensions.w} × ${dimensions.h} px`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={processing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Change Image
                  </button>
                </div>

                {/* Original Image Preview */}
                <div className="relative w-full min-h-[280px] max-h-[460px] rounded-2xl border border-slate-700/80 bg-slate-950 overflow-hidden flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceUrl || ""}
                    alt="Uploaded photo preview"
                    className="max-h-[420px] max-w-full object-contain rounded-lg"
                  />

                  {processing && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
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

                {/* Primary CTA */}
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
                      Remove Background &amp; Open Photo Editor
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs md:text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-rose-300">
                      Background Removal Error
                    </p>
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
        ) : (
          /* STAGE 2: Split-Screen Interactive Fabric.js Photo Editor */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT PANEL (Larger Area): Interactive 800x600 Canvas */}
            <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl shadow-black/30">
              {/* Top Editor Bar & Required Composition Note */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-2 rounded-xl">
                  <Move className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Drag and resize objects on the canvas to create your perfect
                    composition.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={resetAll}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Start New Photo
                </button>
              </div>

              {/* Interactive Fabric.js Canvas Wrapper (Checkerboard reveals transparency) */}
              <div
                ref={canvasWrapperRef}
                className="w-full flex items-center justify-center rounded-2xl border border-slate-700/90 p-2 sm:p-4 bg-slate-950/90 overflow-hidden"
              >
                <div
                  className="rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-slate-700/70"
                  style={checkerboardBgStyle}
                >
                  <canvas ref={canvasElRef} />
                </div>
              </div>

              {/* Bottom Canvas Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                <span>
                  Canvas: <strong className="text-slate-200">800 × 600</strong>{" "}
                  (Exports at 2× HD: 1600 × 1200)
                </span>
                <span>
                  Active Layers:{" "}
                  <strong className="text-emerald-400">{layerCount}</strong> •
                  Click any image to drag, scale corners, or rotate
                </span>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* RIGHT PANEL: Control Panel (Elements, Layers, Backgrounds, Export) */}
            <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl shadow-black/30">
              {/* 1. Secondary Images & Layering Controls */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Elements &amp; Layering
                </h2>

                <input
                  ref={secondaryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAddSecondaryImage}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => secondaryInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Another Image
                </button>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Upload a logo, product, sticker, or second person as a
                  separate draggable layer.
                </p>

                {/* Z-Index Controls */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBringForward}
                    disabled={!hasSelection}
                    className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                    Bring Forward
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBackward}
                    disabled={!hasSelection}
                    className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                    Send Backward
                  </button>
                </div>

                {hasSelection && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Selected Layer
                  </button>
                )}
              </div>

              {/* 2. Canvas Background Options */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    Canvas Background
                  </h2>
                  <button
                    type="button"
                    onClick={() => setBgMode("transparent")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      bgMode === "transparent"
                        ? "bg-indigo-600/25 border-indigo-400 text-indigo-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Transparent
                  </button>
                </div>

                {/* Solid Colors + Color Picker */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Solid Colors
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {SOLID_COLORS.map((color) => {
                      const active =
                        bgMode === "solid" && selectedSolid === color.hex;
                      return (
                        <button
                          key={color.id}
                          type="button"
                          title={color.label}
                          onClick={() => {
                            setSelectedSolid(color.hex);
                            setBgMode("solid");
                          }}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                            active
                              ? "border-indigo-400 scale-110 ring-2 ring-indigo-500/40"
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                          style={{ backgroundColor: color.hex }}
                        >
                          {active && (
                            <Check
                              className={`w-3.5 h-3.5 ${
                                color.hex === "#ffffff"
                                  ? "text-slate-900"
                                  : "text-white"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}

                    <label
                      title="Custom Color Picker"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition ${
                        bgMode === "custom-color"
                          ? "bg-indigo-500/20 border-indigo-400 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          setBgMode("custom-color");
                        }}
                        className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0"
                      />
                      <span>{customColor.toUpperCase()}</span>
                    </label>
                  </div>
                </div>

                {/* Studio Gradients */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Gradients
                  </p>
                  <div className="grid grid-cols-3 gap-2">
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
                          }}
                          className={`rounded-xl p-1 border transition text-left ${
                            active
                              ? "border-indigo-400 bg-indigo-500/15"
                              : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                          }`}
                        >
                          <div
                            className="w-full h-8 rounded-lg mb-1 flex items-center justify-center"
                            style={{ backgroundImage: grad.css }}
                          >
                            {active && (
                              <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                            )}
                          </div>
                          <span className="block text-[10px] font-semibold text-slate-200 px-0.5 truncate">
                            {grad.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Custom Background Image */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Custom Background Photo
                  </p>
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
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      bgMode === "custom-image"
                        ? "bg-indigo-600/25 border-indigo-400 text-indigo-200"
                        : "bg-slate-950 border-slate-700 hover:border-indigo-500/60 text-slate-200"
                    }`}
                  >
                    <ImagePlus className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate">
                      {customBgName
                        ? `BG: ${customBgName}`
                        : "Upload Custom Background"}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Export Final Image */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    Format:
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setExportFormat("png")}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                        exportFormat === "png"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      PNG (HD)
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
                      JPG
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadFinalImage}
                  disabled={exporting}
                  className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Final Image ({exportFormat.toUpperCase()})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Companion Tutorial Link Banner */}
        <div className="max-w-5xl mx-auto bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">
                Learn How to Change Photo Backgrounds &amp; Layer Elements Like a Pro
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Read our step-by-step composition guide for YouTube thumbnails,
                product promos, and layered graphics without Photoshop.
              </p>
            </div>
          </div>
          <Link
            href="/blog/how-to-change-photo-background-and-add-elements-free-editor"
            className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition"
          >
            Read Editor Guide →
          </Link>
        </div>

        <div className="max-w-5xl mx-auto">
          <ToolSeoContent
            toolName="Free AI Background Remover & Interactive Photo Editor"
            aboutParagraphs={[
              "QuickConvert's Free AI Background Remover & Interactive Photo Editor combines 100% client-side AI foreground segmentation with a full Fabric.js interactive design canvas. After isolating your subject locally in the browser with zero cloud uploads, your transparent cutout loads onto an 800×600 studio canvas where you can freely drag, corner-scale, and rotate it into place.",
              "Customize the scene with solid studio colors, multi-stop gradients, a custom color picker, or your own uploaded background photograph. Need to layer a brand logo, badge, sticker, or second product photo? Click Add Another Image to stack multiple interactive layers, control overlap with Bring Forward and Send Backward buttons, and export crisp 2× HD PNG or JPG graphics with zero watermarks.",
            ]}
            howToSteps={[
              {
                title: "Upload Photo & Remove Background Locally",
                detail:
                  "Drop any PNG, JPG, or WebP photo into the browser and click Remove Background. Our self-hosted AI model isolates your subject privately in seconds.",
              },
              {
                title: "Position Subject, Style Background & Add Layers",
                detail:
                  "Drag, scale, and rotate your cutout on the 800×600 canvas, swap in colors, gradients, or custom backdrops, and click Add Another Image to layer logos or extra photos.",
              },
              {
                title: "Arrange Z-Index & Download Final Image",
                detail:
                  "Use Bring Forward and Send Backward to organize overlapping layers, pick PNG or JPG, and click Download Final Image for a crisp watermark-free export.",
              },
            ]}
            highlights={[
              "Self-hosted browser AI background removal—zero photo uploads, zero watermarks, and zero resolution paywalls.",
              "Interactive Fabric.js canvas supporting drag, corner scaling, rotation, and multi-image layering.",
              "Built-in Z-index controls (Bring Forward / Send Backward) for overlapping logos, stickers, and cutouts.",
              "High-resolution 2× HD PNG (transparent or colored) and JPG export directly from the canvas.",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
