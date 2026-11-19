"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Sparkles,
  ShieldCheck,
  Layers,
  Film,
  ImageDown,
  BarChart3,
  Scissors,
  Mic,
} from "lucide-react";
import YouTubeGenerator from "@/components/YouTubeGenerator";
import BackButton from "@/components/BackButton";

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

  // Sync activeTab whenever URL query parameter changes (e.g., clicking Top Navbar buttons or dropdown links)
  useEffect(() => {
    if (tabParam === "youtube") {
      setActiveTab("youtube");
    } else if (tabParam === "converter" || !tabParam) {
      setActiveTab("converter");
    }
  }, [tabParam, modeParam]);

  const handleTabSwitch = (tab: ActiveTab, mode?: string) => {
    setActiveTab(tab);
    const query = mode ? `/?tab=${tab}&mode=${mode}` : `/?tab=${tab}`;
    router.push(query, { scroll: false });
  };

  const isHomeView = !modeParam && activeTab === "converter";

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
    <div className="flex-1 flex flex-col w-full bg-slate-950 text-slate-100">
      {/* Main Full-Width Content Area */}
      <main className="w-full flex-1 flex flex-col min-w-0">
        {/* Centered Workspace Sub-Header Bar */}
        <div className="border-b border-slate-800/80 bg-slate-950/60">
          <div className="max-w-5xl w-full mx-auto px-6 py-5 space-y-3">
            {!isHomeView && (
              <div>
                <BackButton />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
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
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTabSwitch("converter")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
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
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === "youtube"
                    ? "bg-rose-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                YouTube AI Studio
              </button>
              <Link
                href="/tools/video-to-gif"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-purple-400" />
                Video to GIF
              </Link>
              <Link
                href="/tools/thumbnail-downloader"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <ImageDown className="w-3.5 h-3.5 text-emerald-400" />
                Thumbnail Downloader
              </Link>
              <Link
                href="/tools/youtube-audit"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                YouTube SEO Audit
              </Link>
              <Link
                href="/tools/ai-video-clipper"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                AI Video Clipper
              </Link>
              <Link
                href="/tools/audio-transcriber"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                AI Transcriber
              </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Active Tool Workspace */}
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
