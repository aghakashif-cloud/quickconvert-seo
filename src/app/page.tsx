"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  FileSliders,
  Youtube,
  Sparkles,
  ShieldCheck,
  Layers,
  ChevronRight,
  Cpu,
  Home,
  FileVideo,
  FileAudio,
  FileImage,
  FileText,
  Minimize2,
} from "lucide-react";
import YouTubeGenerator from "@/components/YouTubeGenerator";

// Dynamically import FileConverter with SSR disabled so browser-only WASM/Blob APIs load cleanly
const FileConverter = dynamic(() => import("@/components/FileConverter"), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center animate-pulse">
      <p className="text-sm text-slate-400">Loading Client-Side Media Converter Engine...</p>
    </div>
  ),
});

type ActiveTab = "converter" | "youtube";

const MODE_LABELS: Record<string, { title: string; subtitle: string }> = {
  video: {
    title: "Video Converter Studio",
    subtitle: "Convert MP4, WebM, MOV, AVI, MKV, and GIF locally with FFmpeg WASM",
  },
  audio: {
    title: "Audio Converter Studio",
    subtitle: "Convert MP3, WAV, OGG, M4A, and FLAC audio files in your browser",
  },
  image: {
    title: "Image & Icon Converter",
    subtitle: "Convert PNG, JPG, WebP, AVIF, BMP, ICO, and Image to PDF locally",
  },
  document: {
    title: "PDF & Document Converter",
    subtitle: "Convert PDF to PNG/JPG/TXT and DOCX/Text documents to PDF",
  },
  "compress-video": {
    title: "Video Compressor",
    subtitle: "Reduce video file size using custom resolution and bitrate settings",
  },
  "compress-image": {
    title: "Image Compressor",
    subtitle: "Optimize PNG, JPG, and WebP images with the quality slider",
  },
  titles: {
    title: "AI YouTube Title & Hook Generator",
    subtitle: "Generate high-CTR titles, psychological hooks, and thumbnail overlays",
  },
  metadata: {
    title: "AI YouTube Metadata Generator",
    subtitle: "Generate complete SEO descriptions, chapters, titles, and viral tags",
  },
};

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const modeParam = searchParams.get("mode") || "";

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam === "youtube" ? "youtube" : "converter"
  );

  // Sync activeTab whenever URL query parameter changes (e.g., clicking Navbar dropdown links)
  useEffect(() => {
    if (tabParam === "youtube") {
      setActiveTab("youtube");
    } else if (tabParam === "converter") {
      setActiveTab("converter");
    }
  }, [tabParam, modeParam]);

  const handleTabSwitch = (tab: ActiveTab, mode?: string) => {
    setActiveTab(tab);
    const query = mode ? `/?tab=${tab}&mode=${mode}` : `/?tab=${tab}`;
    router.push(query, { scroll: false });
  };

  const activeHeaderInfo = MODE_LABELS[modeParam] || {
    title:
      activeTab === "converter"
        ? "Universal Client-Side File Converter"
        : "AI YouTube Metadata Generator",
    subtitle:
      activeTab === "converter"
        ? "Tool 01 / Local Browser Media & Document Studio"
        : "Tool 02 / Gemini AI Creator Studio",
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-slate-950 text-slate-100">
      {/* Left Sidebar Navigation */}
      <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-slate-900/40 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6">
          {/* Primary Workspace Navigation */}
          <nav className="space-y-1.5" aria-label="Main Tool Navigation">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-2">
              Workspace Navigation
            </p>

            {/* Home / Dashboard Link */}
            <Link
              href="/"
              onClick={() => setActiveTab("converter")}
              className="w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between group text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Home Dashboard</div>
                  <div className="text-[11px] text-slate-400">All Tools Overview</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-transform" />
            </Link>

            <button
              type="button"
              onClick={() => handleTabSwitch("converter")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group ${
                activeTab === "converter"
                  ? "bg-indigo-600/15 text-white border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg transition ${
                    activeTab === "converter"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  <FileSliders className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">File Converter</div>
                  <div className="text-[11px] text-slate-400">
                    Video, Audio, Image &amp; PDF
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  activeTab === "converter"
                    ? "text-indigo-400 translate-x-0.5"
                    : "text-slate-600"
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch("youtube")}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group ${
                activeTab === "youtube"
                  ? "bg-indigo-600/15 text-white border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg transition ${
                    activeTab === "youtube"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  <Youtube className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">YouTube AI Tools</div>
                  <div className="text-[11px] text-slate-400">
                    Gemini SEO Title &amp; Tags
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  activeTab === "youtube"
                    ? "text-rose-400 translate-x-0.5"
                    : "text-slate-600"
                }`}
              />
            </button>
          </nav>

          {/* Quick Category Shortcuts in Sidebar */}
          <div className="hidden lg:block space-y-1.5 pt-2 border-t border-slate-800/80">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 mb-2">
              Quick Shortcuts
            </p>
            <button
              type="button"
              onClick={() => handleTabSwitch("converter", "video")}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
            >
              <FileVideo className="w-3.5 h-3.5 text-indigo-400" />
              Video Converter
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("converter", "audio")}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
            >
              <FileAudio className="w-3.5 h-3.5 text-amber-400" />
              Audio Converter
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("converter", "image")}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
            >
              <FileImage className="w-3.5 h-3.5 text-emerald-400" />
              Image Converter
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("converter", "document")}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Document &amp; PDF Converter
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("converter", "compress-video")}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
            >
              <Minimize2 className="w-3.5 h-3.5 text-purple-400" />
              Compress Video &amp; Image
            </button>
          </div>
        </div>

        {/* Bottom Architecture Info Card */}
        <div className="hidden lg:block p-5 border-t border-slate-800/80 space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Zero-Upload Architecture</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Your files are never sent to a server. All conversions run 100% locally inside your browser using WebAssembly and HTML5 Canvas.
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Next.js App Router</span>
            <span>TypeScript • Tailwind</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Sub-Header Bar inside Workspace */}
        <div className="border-b border-slate-800/80 bg-slate-950/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-400">
              <Layers className="w-3.5 h-3.5" />
              <span>{activeHeaderInfo.subtitle}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-0.5">
              {activeHeaderInfo.title}
            </h1>
          </div>

          {/* Quick Tool Switcher Pills */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTabSwitch("converter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "converter"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              File Converter
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("youtube")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "youtube"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              YouTube AI Tools
            </button>
          </div>
        </div>

        {/* Active Tool Workspace */}
        <div className="p-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
          {activeTab === "converter" ? <FileConverter /> : <YouTubeGenerator />}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-slate-950 p-12 text-center text-sm text-slate-400">
          Loading workspace...
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
