"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Youtube,
  Download,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Info,
} from "lucide-react";

interface ThumbnailResolution {
  id: "maxres" | "sd" | "hq" | "mq";
  label: string;
  dimensions: string;
  badge: string;
  filenameSuffix: string;
  url: string;
}

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    );

    // youtu.be/<id>
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/watch?v=<id>
    const vParam = url.searchParams.get("v");
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    // youtube.com/shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
    const pathParts = url.pathname.split("/").filter(Boolean);
    const markerIndex = pathParts.findIndex((p) =>
      ["shorts", "embed", "live", "v"].includes(p)
    );
    if (markerIndex !== -1 && pathParts[markerIndex + 1]) {
      const candidate = pathParts[markerIndex + 1].substring(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) return candidate;
    }
  } catch {
    // Fallback regex match
  }

  const regex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

export default function ThumbnailDownloaderPage() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Track which resolutions returned YouTube's 120x90 grey missing placeholder
  const [unavailableMap, setUnavailableMap] = useState<Record<string, boolean>>({});
  // Track the active resolution index for the main hero preview (0 = maxres, 1 = sd, 2 = hq)
  const [heroIndex, setHeroIndex] = useState<number>(0);

  const applyVideoId = (id: string) => {
    setError(null);
    setUnavailableMap({});
    setHeroIndex(0);
    setVideoId(id);
  };

  const handleFetchThumbnails = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const extracted = extractYouTubeVideoId(urlInput);
    if (!extracted) {
      setError(
        "Please enter a valid YouTube video URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ)."
      );
      setVideoId(null);
      return;
    }
    applyVideoId(extracted);
  };

  const loadSampleVideo = () => {
    const sampleUrl = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
    setUrlInput(sampleUrl);
    applyVideoId("aqz-KE-bpKQ");
  };

  const getResolutions = (id: string): ThumbnailResolution[] => [
    {
      id: "maxres",
      label: "Maximum HD (Full HD / 4K)",
      dimensions: "1280 × 720 px",
      badge: "Best Quality (maxresdefault.jpg)",
      filenameSuffix: "maxresdefault",
      url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    },
    {
      id: "sd",
      label: "Standard Definition (SD)",
      dimensions: "640 × 480 px",
      badge: "SD Quality (sddefault.jpg)",
      filenameSuffix: "sddefault",
      url: `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    },
    {
      id: "hq",
      label: "High Quality (HQ)",
      dimensions: "480 × 360 px",
      badge: "HQ Quality (hqdefault.jpg)",
      filenameSuffix: "hqdefault",
      url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    },
    {
      id: "mq",
      label: "Medium Quality (MQ)",
      dimensions: "320 × 180 px",
      badge: "Compact 16:9 (mqdefault.jpg)",
      filenameSuffix: "mqdefault",
      url: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    },
  ];

  const resolutions = videoId ? getResolutions(videoId) : [];

  // Fallback handler when the Hero image loads or errors
  const handleHeroImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // YouTube returns a 120x90 grey placeholder when maxresdefault or sddefault does not exist
    if (img.naturalWidth <= 120) {
      const currentRes = resolutions[heroIndex];
      if (currentRes) {
        setUnavailableMap((prev) => ({ ...prev, [currentRes.id]: true }));
      }
      if (heroIndex < 2) {
        setHeroIndex((prev) => prev + 1);
      }
    }
  };

  const handleHeroImageError = () => {
    const currentRes = resolutions[heroIndex];
    if (currentRes) {
      setUnavailableMap((prev) => ({ ...prev, [currentRes.id]: true }));
    }
    if (heroIndex < 2) {
      setHeroIndex((prev) => prev + 1);
    }
  };

  // Detect 120px grey placeholder on individual resolution cards as well
  const handleCardImageLoad = (
    resId: ThumbnailResolution["id"],
    e: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 120) {
      setUnavailableMap((prev) =>
        prev[resId] ? prev : { ...prev, [resId]: true }
      );
      if (resId === "maxres" && heroIndex === 0) {
        setHeroIndex(1);
      } else if (resId === "sd" && heroIndex === 1) {
        setHeroIndex(2);
      }
    }
  };

  const handleCardImageError = (resId: ThumbnailResolution["id"]) => {
    setUnavailableMap((prev) =>
      prev[resId] ? prev : { ...prev, [resId]: true }
    );
    if (resId === "maxres" && heroIndex === 0) {
      setHeroIndex(1);
    } else if (resId === "sd" && heroIndex === 1) {
      setHeroIndex(2);
    }
  };

  // Download image directly by fetching as Blob
  const handleDownloadImage = async (res: ThumbnailResolution) => {
    if (!videoId || unavailableMap[res.id]) return;
    setDownloadingId(res.id);

    try {
      const response = await fetch(res.url, { mode: "cors" });
      if (!response.ok) throw new Error("Direct fetch failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `youtube-thumbnail-${videoId}-${res.filenameSuffix}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open image in new tab so user can save directly
      window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  const copyImageUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const activeHeroResolution = resolutions[heroIndex] || resolutions[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Tool Navigation Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Youtube className="w-4 h-4" />
              Creator Utility / YouTube Studio
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              YouTube Thumbnail Downloader (HD &amp; 4K)
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Paste any YouTube video or Shorts link below to view and download its highest-resolution thumbnail image instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/?tab=converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              File Converter
            </Link>
            <Link
              href="/tools/video-to-gif"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Video to GIF
            </Link>
            <Link
              href="/?tab=youtube"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Metadata Studio
            </Link>
          </div>
        </div>

        {/* URL Search Box */}
        <form
          onSubmit={handleFetchThumbnails}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="youtube-url-input"
              className="text-sm font-semibold text-slate-200 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-rose-400" />
              Enter YouTube Video or Shorts URL
            </label>
            <button
              type="button"
              onClick={loadSampleVideo}
              className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
            >
              Try Sample Video URL
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="youtube-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2 shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
              Get Thumbnail
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-xs md:text-sm text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Extracted Thumbnail Results */}
        {videoId && activeHeroResolution && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Primary Highest-Available Resolution Preview Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Video ID: <code className="font-mono">{videoId}</code>
                    </span>
                    {heroIndex > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                        <Info className="w-3.5 h-3.5" />
                        1280×720 not uploaded by creator — showing highest available ({activeHeroResolution.dimensions})
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-white">
                    Highest Available Thumbnail: {activeHeroResolution.label} ({activeHeroResolution.dimensions})
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      copyImageUrl(
                        activeHeroResolution.url,
                        `hero-${activeHeroResolution.id}`
                      )
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    {copiedId === `hero-${activeHeroResolution.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        URL Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Image URL
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage(activeHeroResolution)}
                    disabled={downloadingId === activeHeroResolution.id}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-600/25 transition flex items-center gap-2"
                  >
                    {downloadingId === activeHeroResolution.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Image ({activeHeroResolution.dimensions})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Large Preview Image with automatic fallback (maxres -> sd -> hq) */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video max-h-[480px] mx-auto flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activeHeroResolution.url}
                  src={activeHeroResolution.url}
                  onLoad={handleHeroImageLoad}
                  onError={handleHeroImageError}
                  alt={`YouTube Thumbnail ${activeHeroResolution.filenameSuffix} for video ${videoId}`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* All Available Sizes Grid */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-200">
                All Thumbnail Resolutions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {resolutions.map((res) => {
                  const isUnavailable = Boolean(unavailableMap[res.id]);
                  const fallbackPreviewUrl = isUnavailable
                    ? activeHeroResolution.url
                    : res.url;

                  return (
                    <div
                      key={res.id}
                      className={`bg-slate-900/70 border rounded-xl p-4 flex flex-col justify-between gap-4 transition ${
                        isUnavailable
                          ? "border-slate-800/60 opacity-65"
                          : "border-slate-800"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={fallbackPreviewUrl}
                            onLoad={(e) =>
                              !isUnavailable && handleCardImageLoad(res.id, e)
                            }
                            onError={() =>
                              !isUnavailable && handleCardImageError(res.id)
                            }
                            alt={`${res.label} thumbnail`}
                            className="w-full h-full object-cover"
                          />
                          {isUnavailable && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center p-2 text-center">
                              <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md">
                                Not available for this video
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              isUnavailable
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                            }`}
                          >
                            {res.dimensions}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100 mt-1.5">
                            {res.label}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {res.badge}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleDownloadImage(res)}
                          disabled={isUnavailable || downloadingId === res.id}
                          className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {isUnavailable ? "Unavailable" : "Download"}
                        </button>
                        {!isUnavailable && (
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open image in new tab"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SEO Guide Section for Thumbnail Downloader */}
        <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-bold text-white">
            How to Download Any YouTube Thumbnail in Full HD
          </h2>
          <p className="text-slate-400">
            Whether you need to recover a backup copy of your own channel&apos;s artwork, study high-CTR thumbnail designs in your niche for inspiration, or embed a video preview image in a blog post, our free <strong>YouTube Thumbnail Downloader</strong> retrieves every resolution stored on YouTube&apos;s image servers (`maxresdefault.jpg`, `sddefault.jpg`, `hqdefault.jpg`, and `mqdefault.jpg`) in one click—and automatically falls back to the highest available resolution if a video was uploaded without a 1280×720 thumbnail.
          </p>
        </section>
      </div>
    </div>
  );
}
