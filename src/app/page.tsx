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
  Headphones,
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
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            {!isHomeView && (
              <div>
                <BackButton />
              </div>
            )}

            {/* Vertical stack on mobile with clear spacing between badge, H1, and tabs */}
            <div className="flex flex-col gap-4 w-full min-w-0">
              <div className="flex flex-col gap-2 min-w-0 w-full">
                <div className="inline-flex items-start sm:items-center gap-2 text-xs font-medium text-indigo-400 leading-snug">
                  <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">{activeHeaderInfo.subtitle}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight break-words">
                  {activeHeaderInfo.title}
                </h1>
              </div>

              {/* Quick Tool Switcher Pills — wraps cleanly across lines on narrow screens */}
              <nav
                aria-label="Quick Tool Switcher"
                className="w-full mt-1 mb-1 flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl"
              >
                <button
                  type="button"
                  onClick={() => handleTabSwitch("converter")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "converter"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>File Converter</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabSwitch("youtube")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "youtube"
                      ? "bg-rose-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>YouTube AI Studio</span>
                </button>
                <Link
                  href="/tools/video-to-gif"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Video to GIF</span>
                </Link>
                <Link
                  href="/tools/thumbnail-downloader"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ImageDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Thumbnail Downloader</span>
                </Link>
                <Link
                  href="/tools/youtube-audit"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>YouTube SEO Audit</span>
                </Link>
                <Link
                  href="/tools/ai-video-clipper"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Scissors className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>AI Video Clipper</span>
                </Link>
                <Link
                  href="/tools/audio-transcriber"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>AI Transcriber</span>
                </Link>
                <Link
                  href="/tools/pdf-to-audiobook"
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Headphones className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>PDF to Audiobook</span>
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* Centered Active Tool Workspace */}
        <div className="px-4 py-6 sm:px-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
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
