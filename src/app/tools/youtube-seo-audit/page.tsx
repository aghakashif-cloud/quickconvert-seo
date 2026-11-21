"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  Youtube,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  FileText,
  Tag,
  TrendingUp,
  Copy,
  Check,
  Loader2,
  Lightbulb,
  BarChart3,
} from "lucide-react";

interface ExtractedVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  channelName: string;
  thumbnailUrl: string;
}

interface SectionAnalysis {
  status: "good" | "warning" | "critical" | string;
  feedback: string;
  strengths: string[];
  warnings: string[];
  improvedTitleSuggestion?: string;
  recommendedTags?: string[];
}

interface AuditReport {
  score: number;
  scoreSummary: string;
  titleAnalysis: SectionAnalysis;
  descriptionAnalysis: SectionAnalysis;
  tagsAnalysis: SectionAnalysis;
  actionableTips: string[];
  optimizedTitle?: string;
  optimizedDescription?: string;
  optimizedTags?: string[];
}

export default function YouTubeAuditPage() {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<ExtractedVideoMetadata | null>(
    null
  );
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAnalyze = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = (overrideUrl ?? urlInput).trim();
    if (!targetUrl) {
      setError("Please enter a YouTube video URL to analyze.");
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const res = await fetch("/api/youtube-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        if (res.status === 504 || res.status === 502) {
          throw new Error(
            `The audit request timed out on the server (HTTP ${res.status}). Please try again in a moment.`
          );
        }
        throw new Error(
          `Server returned an unexpected response (HTTP ${res.status}). Please try again later.`
        );
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || `Request failed with status ${res.status}.`
        );
      }

      setVideoData(data.videoData);
      setAudit(data.audit);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "The audit request timed out while waiting for YouTube and Gemini AI. Please try again."
        );
      } else if (
        err instanceof TypeError &&
        err.message.toLowerCase().includes("failed to fetch")
      ) {
        setError(
          "Could not reach the audit server (network error or server timeout). Please check your connection and try again."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while auditing the video."
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const loadSampleAudit = () => {
    const sample = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
    setUrlInput(sample);
    handleAnalyze(undefined, sample);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(field);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) {
      return {
        ring: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
        badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        bar: "bg-emerald-500",
        label: "Excellent SEO",
      };
    }
    if (score >= 55) {
      return {
        ring: "border-amber-500 text-amber-400 bg-amber-500/10",
        badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        bar: "bg-amber-500",
        label: "Needs Optimization",
      };
    }
    return {
      ring: "border-rose-500 text-rose-400 bg-rose-500/10",
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      bar: "bg-rose-500",
      label: "Critical SEO Gaps",
    };
  };

  const getStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase();
    if (normalized === "good") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Optimized
        </span>
      );
    }
    if (normalized === "warning") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          Can Be Improved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        Action Required
      </span>
    );
  };

  const scoreStyle = audit ? getScoreColor(audit.score) : null;
  const resolvedOptimizedTitle =
    audit?.optimizedTitle || audit?.titleAnalysis?.improvedTitleSuggestion || "";
  const resolvedOptimizedDescription = audit?.optimizedDescription || "";
  const resolvedOptimizedTags =
    audit?.optimizedTags && audit.optimizedTags.length > 0
      ? audit.optimizedTags
      : audit?.tagsAnalysis?.recommendedTags || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              AI-Powered YouTube SEO Scorecard
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              YouTube SEO Audit &amp; Video Analyzer
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Paste any YouTube video URL to extract its live Title, Description, and Tags and receive an instant AI SEO score (0–100) with actionable fixes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/youtube-ai-studio"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Metadata Generator
            </Link>
            <Link
              href="/tools/thumbnail-downloader"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Thumbnail Downloader
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              File Converter
            </Link>
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => handleAnalyze(e)}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="audit-url-input"
              className="text-sm font-semibold text-slate-200 flex items-center gap-2"
            >
              <Youtube className="w-4 h-4 text-rose-400" />
              Paste YouTube Video URL to Audit
            </label>
            <button
              type="button"
              onClick={loadSampleAudit}
              disabled={loading}
              className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
            >
              Try Sample Video Audit
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="audit-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Video SEO...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze Video
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-2.5 text-xs md:text-sm text-rose-300">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Results Scorecard */}
        {audit && videoData && scoreStyle && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Scorecard Summary Banner */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
              {/* Circular Score Gauge */}
              <div
                className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${scoreStyle.ring}`}
              >
                <span className="text-3xl font-extrabold">{audit.score}</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-300">
                  / 100 Score
                </span>
              </div>

              {/* Video Details & Score Summary */}
              <div className="flex-1 space-y-2 text-center md:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-0.5 rounded-full border ${scoreStyle.badge}`}
                  >
                    {scoreStyle.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    Channel:{" "}
                    <strong className="text-slate-200">
                      {videoData.channelName}
                    </strong>
                  </span>
                </div>

                <h2 className="text-lg md:text-xl font-bold text-white truncate">
                  {videoData.title}
                </h2>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  {audit.scoreSummary}
                </p>

                {/* Score Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden pt-0.5">
                  <div
                    className={`h-full transition-all duration-500 ${scoreStyle.bar}`}
                    style={{ width: `${Math.min(100, Math.max(5, audit.score))}%` }}
                  />
                </div>
              </div>

              {/* Thumbnail Preview */}
              <div className="hidden lg:block w-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={videoData.thumbnailUrl}
                  alt={videoData.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* 1. Title Audit Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    Title SEO Analysis ({videoData.title.length} characters)
                  </h3>
                </div>
                {getStatusBadge(audit.titleAnalysis.status)}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-slate-200">
                Current Title: &ldquo;{videoData.title}&rdquo;
              </div>

              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {audit.titleAnalysis.feedback}
              </p>

              {/* Green Strengths & Red Warnings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    What Works Well
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.titleAnalysis.strengths?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Warnings &amp; Issues
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.titleAnalysis.warnings?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">!</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {audit.titleAnalysis.improvedTitleSuggestion && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block">
                      AI Recommended High-CTR Title Rewrite:
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {audit.titleAnalysis.improvedTitleSuggestion}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        audit.titleAnalysis.improvedTitleSuggestion || "",
                        "improvedTitle"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 shrink-0"
                  >
                    {copiedField === "improvedTitle" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Title
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 2. Description Audit Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">
                    Description SEO Analysis ({videoData.description.length}{" "}
                    characters)
                  </h3>
                </div>
                {getStatusBadge(audit.descriptionAnalysis.status)}
              </div>

              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {audit.descriptionAnalysis.feedback}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.descriptionAnalysis.strengths?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Missing Elements / Warnings
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.descriptionAnalysis.warnings?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">!</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. Tags Audit Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Tags &amp; Keywords Analysis ({videoData.tags.length}{" "}
                    extracted tags)
                  </h3>
                </div>
                {getStatusBadge(audit.tagsAnalysis.status)}
              </div>

              {videoData.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-medium">
                    Current Video Tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {videoData.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {audit.tagsAnalysis.feedback}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Tag Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.tagsAnalysis.strengths?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Tag Warnings
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.tagsAnalysis.warnings?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">!</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Tags to Add */}
              {audit.tagsAnalysis.recommendedTags &&
                audit.tagsAnalysis.recommendedTags.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-300">
                        Recommended High-Value Tags to Add:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            audit.tagsAnalysis.recommendedTags!.join(", "),
                            "recTags"
                          )
                        }
                        className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
                      >
                        {copiedField === "recTags" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied CSV!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Recommended Tags
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {audit.tagsAnalysis.recommendedTags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 font-medium"
                        >
                          +{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* 4. AI-Optimized Suggestions (Ready-to-Use Solutions) */}
            {(resolvedOptimizedTitle ||
              resolvedOptimizedDescription ||
              resolvedOptimizedTags.length > 0) && (
              <div className="bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 space-y-5 shadow-xl shadow-indigo-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-lg font-bold text-white">
                        AI-Optimized Suggestions
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Ready-to-use SEO solutions tailored to this video. Copy and paste directly into YouTube Studio.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    Copy &amp; Use on YouTube
                  </span>
                </div>

                {/* Optimized Title Box */}
                {resolvedOptimizedTitle && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          Optimized Title
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            resolvedOptimizedTitle.length <= 60
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {resolvedOptimizedTitle.length} / 60 chars
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            resolvedOptimizedTitle,
                            "optimizedTitle"
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-700 transition flex items-center gap-1.5 shrink-0"
                      >
                        {copiedField === "optimizedTitle" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm md:text-base font-bold text-white leading-snug">
                      {resolvedOptimizedTitle}
                    </p>
                  </div>
                )}

                {/* Optimized Description Box */}
                {resolvedOptimizedDescription && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                          Optimized Description
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          ({resolvedOptimizedDescription.length} chars)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            resolvedOptimizedDescription,
                            "optimizedDescription"
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-700 transition flex items-center gap-1.5 shrink-0"
                      >
                        {copiedField === "optimizedDescription" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs md:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {resolvedOptimizedDescription}
                    </div>
                  </div>
                )}

                {/* Optimized Tags Box */}
                {resolvedOptimizedTags.length > 0 && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Optimized Tags
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {resolvedOptimizedTags.length} tags
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            resolvedOptimizedTags.join(", "),
                            "optimizedTags"
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-700 transition flex items-center gap-1.5 shrink-0"
                      >
                        {copiedField === "optimizedTags" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resolvedOptimizedTags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Prioritized Actionable SEO Tips */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Prioritized Action Plan to Improve Video Rankings
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {audit.actionableTips?.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <ToolSeoContent
          toolName="YouTube SEO Audit & Video Analyzer"
          aboutParagraphs={[
            "The YouTube SEO Audit & Video Analyzer inspects any public YouTube video URL to evaluate how well its metadata is optimized for YouTube Search and Suggested Video discovery. It extracts the live video title, full description, and hidden keyword tags, then runs an AI-powered scorecard analysis from 0 to 100 that pinpoints weak hooks, missing keywords, and description gaps.",
            "Beyond scoring what is currently live, the analyzer generates ready-to-paste optimized metadata—including a stronger high-CTR title, a rewritten search-friendly description, and targeted keyword tags—plus a prioritized action plan you can apply immediately inside YouTube Studio to boost impressions and click-through rate.",
          ]}
          howToSteps={[
            {
              title: "Paste a YouTube Video URL",
              detail:
                "Copy any standard YouTube watch link, Shorts URL, or youtu.be link and paste it into the analyzer bar above.",
            },
            {
              title: "Run the AI SEO Audit",
              detail:
                "Click Audit Video SEO to fetch live metadata and compute an instant 0-100 SEO score across title, description, and tag quality.",
            },
            {
              title: "Apply the Optimized Fixes",
              detail:
                "Review the prioritized recommendations and copy the AI-rewritten title, description, and keyword tags directly into YouTube Studio.",
            },
          ]}
          highlights={[
            "Instant 0-100 YouTube SEO scorecard breaking down title length, click appeal, description structure, and tag coverage.",
            "Extracts live metadata from public YouTube videos and Shorts without requiring channel OAuth login.",
            "Generates copy-ready optimized titles, SEO descriptions, and high-intent keyword tags powered by Gemini AI.",
            "Actionable, prioritized improvement tips tailored specifically to the audited video's topic and niche.",
          ]}
        />
      </div>
    </div>
  );
}
