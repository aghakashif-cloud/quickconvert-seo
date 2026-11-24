"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import { useDropzone, type FileRejection } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import {
  Files,
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
  ShieldCheck,
  Sparkles,
  Plus,
} from "lucide-react";

interface PdfQueueItem {
  id: string;
  file: File;
  pageCount: number | null;
}

interface MergedResult {
  url: string;
  size: number;
  totalPages: number;
  fileCount: number;
  filename: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function MergePdfPage() {
  const [pdfItems, setPdfItems] = useState<PdfQueueItem[]>([]);
  const [outputFilename, setOutputFilename] = useState<string>("merged-document");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [merging, setMerging] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mergedResult, setMergedResult] = useState<MergedResult | null>(null);

  // Revoke previous Blob URL on unmount or when replaced
  useEffect(() => {
    return () => {
      if (mergedResult?.url) {
        URL.revokeObjectURL(mergedResult.url);
      }
    };
  }, [mergedResult]);

  const clearMergedResult = useCallback(() => {
    setMergedResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      setErrorMessage(null);

      if (rejections.length > 0 && acceptedFiles.length === 0) {
        setErrorMessage("Please upload valid PDF (.pdf) files only.");
        return;
      }

      const validPdfs = acceptedFiles.filter(
        (f) =>
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf")
      );

      if (validPdfs.length === 0) {
        setErrorMessage("Please upload valid PDF (.pdf) files only.");
        return;
      }

      clearMergedResult();

      const newItems: PdfQueueItem[] = await Promise.all(
        validPdfs.map(async (file) => {
          let pageCount: number | null = null;
          try {
            const buf = await file.arrayBuffer();
            const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
            pageCount = doc.getPageCount();
          } catch {
            pageCount = null;
          }
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            pageCount,
          };
        })
      );

      setPdfItems((prev) => [...prev, ...newItems]);
    },
    [clearMergedResult]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pdfItems.length) return;
    clearMergedResult();
    setPdfItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const removeItem = (id: string) => {
    clearMergedResult();
    setErrorMessage(null);
    setPdfItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    if (merging) return;
    clearMergedResult();
    setPdfItems([]);
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
    clearMergedResult();
    setPdfItems((prev) => {
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

  const handleMergePdfs = async () => {
    if (merging) return;
    if (pdfItems.length < 2) {
      setErrorMessage("Please add at least 2 PDF files to merge them together.");
      return;
    }

    setMerging(true);
    setErrorMessage(null);
    clearMergedResult();
    setProgress(5);
    setStatusText("Initializing new PDF document locally...");

    try {
      const mergedPdf = await PDFDocument.create();
      let totalPages = 0;

      for (let i = 0; i < pdfItems.length; i++) {
        const item = pdfItems[i];
        const stepStart = Math.round(10 + (i / pdfItems.length) * 75);
        setProgress(stepStart);
        setStatusText(
          `Reading & copying pages from file ${i + 1} of ${pdfItems.length}: ${item.file.name}...`
        );

        const arrayBuffer = await item.file.arrayBuffer();
        let sourcePdf: PDFDocument;
        try {
          sourcePdf = await PDFDocument.load(arrayBuffer);
        } catch {
          throw new Error(
            `Could not read "${item.file.name}". It may be password-protected, encrypted, or corrupted.`
          );
        }

        const pageIndices = sourcePdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
          totalPages += 1;
        });
      }

      setProgress(90);
      setStatusText(`Finalizing merged PDF (${totalPages} total pages)...`);

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const blobUrl = URL.createObjectURL(blob);

      const cleanBase =
        outputFilename
          .trim()
          .replace(/\.pdf$/i, "")
          .replace(/[^a-zA-Z0-9 _-]/g, "")
          .trim() || "merged-document";
      const finalName = `${cleanBase}.pdf`;

      setProgress(100);
      setStatusText(
        `Successfully merged ${pdfItems.length} PDF files (${totalPages} pages) 100% locally!`
      );
      setMergedResult({
        url: blobUrl,
        size: blob.size,
        totalPages,
        fileCount: pdfItems.length,
        filename: finalName,
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while merging your PDF files."
      );
      setProgress(0);
      setStatusText("");
    } finally {
      setMerging(false);
    }
  };

  const totalInputSize = pdfItems.reduce((sum, item) => sum + item.file.size, 0);
  const knownTotalPages = pdfItems.reduce(
    (sum, item) => sum + (item.pageCount || 0),
    0
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
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Files className="w-4 h-4" />
              PDF Studio • 100% Client-Side pdf-lib Engine
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Merge PDF Files Online
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Combine multiple PDF files into one organized document locally inside your browser. Reorder files freely and download instantly with zero server uploads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              File Converter
            </Link>
            <Link
              href="/tools/pdf-to-audiobook"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              PDF to Audiobook
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

        {/* Zero-Upload Privacy Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center justify-center gap-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs md:text-sm font-medium text-emerald-300">
            100% Private: Your PDF documents never leave your device. All merging happens locally in your browser using pdf-lib.
          </p>
        </div>

        {/* Drag-and-Drop Upload Zone */}
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 md:p-12 text-center ${
            isDragActive
              ? "border-rose-400 bg-rose-500/10 scale-[0.995]"
              : "border-slate-700/80 hover:border-rose-500/70 bg-slate-900/50 hover:bg-slate-900/80"
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 via-indigo-500/20 to-purple-500/20 border border-rose-500/30 flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-slate-100">
            {isDragActive
              ? "Drop your PDF files here..."
              : pdfItems.length > 0
              ? "Drag & Drop More PDF Files to Append"
              : "Drag & Drop Multiple PDF Files Here"}
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xl mx-auto">
            Select two or more <strong className="text-slate-300">.PDF</strong> files from your device. You can reorder them with arrows or drag-and-drop before merging.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-rose-600/20 transition">
              <Plus className="w-4 h-4" />
              {pdfItems.length > 0 ? "Add More PDFs" : "Select PDF Files"}
            </span>
          </div>
        </div>

        {/* Uploaded PDF Queue & Reordering Controls */}
        {pdfItems.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Queue Toolbar */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                  <Files className="w-4 h-4 text-rose-400" />
                  PDF Merge Order ({pdfItems.length}{" "}
                  {pdfItems.length === 1 ? "file" : "files"})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total size: {formatBytes(totalInputSize)}
                  {knownTotalPages > 0 && ` • ~${knownTotalPages} pages`} • Drag rows or use arrows to reorder
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={open}
                  disabled={merging}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add PDFs
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={merging}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>

                <button
                  type="button"
                  onClick={handleMergePdfs}
                  disabled={merging || pdfItems.length < 2}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
                >
                  {merging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging ({progress}%)...
                    </>
                  ) : (
                    <>
                      <Files className="w-4 h-4" />
                      Merge PDFs
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output Filename Field */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label
                htmlFor="merged-filename-input"
                className="text-xs font-semibold text-slate-400 shrink-0"
              >
                Output filename:
              </label>
              <div className="flex items-center gap-1.5 max-w-xs w-full">
                <input
                  id="merged-filename-input"
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  disabled={merging}
                  placeholder="merged-document"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none text-xs font-medium text-slate-100 disabled:opacity-50"
                />
                <span className="text-xs font-mono text-slate-400">.pdf</span>
              </div>
              {pdfItems.length < 2 && (
                <span className="text-xs text-amber-300 sm:ml-auto">
                  Add at least 1 more PDF to merge.
                </span>
              )}
            </div>

            {/* Sortable PDF List */}
            <div className="divide-y divide-slate-800/80">
              {pdfItems.map((item, idx) => (
                <div
                  key={item.id}
                  draggable={!merging}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition ${
                    draggedIndex === idx
                      ? "bg-indigo-500/10"
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
                    <span className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-rose-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-semibold text-slate-100 truncate max-w-xs sm:max-w-md">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatBytes(item.file.size)}
                        {item.pageCount !== null &&
                          ` • ${item.pageCount} ${
                            item.pageCount === 1 ? "page" : "pages"
                          }`}
                      </p>
                    </div>
                  </div>

                  {/* Move Up, Move Down & Remove */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={merging || idx === 0}
                      title="Move Up"
                      aria-label={`Move ${item.file.name} up`}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-700/80 transition"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={merging || idx === pdfItems.length - 1}
                      title="Move Down"
                      aria-label={`Move ${item.file.name} down`}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-700/80 transition"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={merging}
                      title="Remove PDF"
                      aria-label={`Remove ${item.file.name}`}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 disabled:opacity-30 border border-slate-700/80 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Merging Progress Bar */}
            {(merging || progress > 0) && (
              <div className="px-5 py-4 bg-slate-950/90 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2 truncate">
                    {merging ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">{statusText}</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-300 shrink-0 ml-2">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      progress >= 100
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-rose-500 to-indigo-500"
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

        {/* Download Merged PDF Success Card */}
        {mergedResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Your Merged PDF Is Ready!
                </h3>
                <p className="text-xs md:text-sm text-emerald-200/90 mt-0.5">
                  Combined <strong>{mergedResult.fileCount} files</strong> into{" "}
                  <strong>{mergedResult.totalPages} pages</strong> (
                  {formatBytes(mergedResult.size)}) — {mergedResult.filename}
                </p>
              </div>
            </div>

            <a
              href={mergedResult.url}
              download={mergedResult.filename}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Merged PDF
            </a>
          </div>
        )}

        {/* SEO Content Section */}
        <ToolSeoContent
          toolName="Merge PDF Online Tool"
          aboutParagraphs={[
            "Our free Merge PDF tool lets you combine multiple PDF documents—such as invoices, signed contracts, university assignments, scanned receipts, and portfolio pages—into a single clean PDF file directly inside your web browser. Powered by the open-source pdf-lib engine, every byte is processed locally on your own device without uploading private documents to external cloud servers.",
            "Unlike traditional online PDF combiners that enforce strict file limits, add watermarks, or hold your documents on remote storage, QuickConvert gives you unlimited client-side merging with instant page-count inspection, drag-and-drop or arrow-button reordering, and customizable output filenames.",
          ]}
          howToSteps={[
            {
              title: "Upload Multiple PDF Files",
              detail:
                "Drag and drop two or more PDF files into the dropzone above (or click Select PDF Files to browse your computer or phone).",
            },
            {
              title: "Arrange the Exact Document Order",
              detail:
                "Use the Move Up / Move Down arrow buttons—or drag any row by its handle—to set the exact sequence in which pages should appear.",
            },
            {
              title: "Merge & Download Locally",
              detail:
                "Optionally customize your output filename, click Merge PDFs, and download your combined PDF file immediately with zero upload delay.",
            },
          ]}
          highlights={[
            "100% client-side PDF merging using pdf-lib—your confidential contracts, tax forms, and reports never leave your browser.",
            "Preserves original PDF vector text, layouts, hyperlinks, and image resolution across every merged page.",
            "Supports both Move Up / Move Down arrows and smooth drag-and-drop row reordering with live page counts.",
            "Completely free with no account registration, no daily limits, and zero watermarks on your merged PDF.",
          ]}
        />
      </div>
    </div>
  );
}
