"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Youtube,
  Copy,
  Check,
  RefreshCw,
  Tag,
  FileText,
  AlertCircle,
  Wand2,
  Eye,
  Flame,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface YouTubeMetadataResult {
  primaryTitle: string;
  alternativeTitles: string[];
  description: string;
  tags: string[];
  thumbnailHook: string;
  angleUsed?: string;
  generatedAt?: string;
}

const SAMPLE_TOPICS = [
  "I built a 100% client-side file converter in Next.js using WebAssembly FFmpeg and the HTML5 Canvas API so users never have to upload private videos to cloud servers.",
  "10 productivity habits that helped me code 3x faster as a solo full-stack developer without burning out.",
  "Complete beginner's guide to lighting and framing cinematic YouTube videos in a small bedroom studio under $150.",
];

export default function YouTubeGenerator() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("High-CTR & Engaging");
  const [targetAudience, setTargetAudience] = useState("");
  const [videoType, setVideoType] = useState("Long-form Video");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YouTubeMetadataResult | null>(null);
  const [generationCount, setGenerationCount] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a video topic, script summary, or transcript first.");
      return;
    }

    setLoading(true);
    setError(null);
    const nextSeed = generationCount + 1;
    setGenerationCount(nextSeed);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone,
          targetAudience,
          videoType,
          variationSeed: `${nextSeed}-${Math.random().toString(36).slice(2)}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate metadata.");
      }

      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating YouTube metadata."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clean Production Header Banner */}
      <div className="bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-purple-500/10 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
            <Youtube className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base md:text-lg font-bold text-slate-100">
                AI YouTube Metadata &amp; SEO Studio
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Powered by Gemini AI
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Paste a video topic, rough outline, or full transcript to generate fresh, high-CTR titles, chapters, descriptions, and SEO tags on every run.
            </p>
          </div>
        </div>

        {/* Right Decorative SEO Badge */}
        <div className="hidden sm:flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shrink-0">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">High-CTR Engine</div>
            <div className="text-[10px] text-slate-400">Titles • Chapters • Tags</div>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label
              htmlFor="youtube-topic-input"
              className="text-sm font-semibold text-slate-200 flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              Video Topic, Script Outline, or Transcript
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Try sample:</span>
              {SAMPLE_TOPICS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTopic(sample)}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
                >
                  Idea #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <textarea
            id="youtube-topic-input"
            rows={4}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe what your video is about, or paste your full video transcript here..."
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-y"
          />
        </div>

        {/* Customization Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Tone &amp; Hook Style
            </label>
            <select
              aria-label="Tone and Hook Style"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="High-CTR & Engaging">High-CTR &amp; Engaging (Default)</option>
              <option value="Educational & Authoritative">Educational &amp; Authoritative</option>
              <option value="Storytelling & Documentary">Storytelling &amp; Documentary</option>
              <option value="Fast-Paced & Hype">Fast-Paced &amp; Hype</option>
              <option value="Minimalist & Honest">Minimalist &amp; Honest</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="target-audience-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Target Audience (Optional)
            </label>
            <input
              id="target-audience-input"
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Gamers, Students, Tech Enthusiasts..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Video Format
            </label>
            <select
              aria-label="Video Format"
              value={videoType}
              onChange={(e) => setVideoType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Long-form Video">Standard Long-Form Video</option>
              <option value="Tutorial / Deep Dive">In-Depth Tutorial / Guide</option>
              <option value="YouTube Shorts">YouTube Shorts (Vertical)</option>
              <option value="Podcast / Interview">Podcast Episode / Interview</option>
            </select>
          </div>
        </div>

        {/* Submit / Regenerate CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Dynamic creative angle &amp; entropy injection guarantees unique results every time you click.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Fresh Metadata...
              </>
            ) : result ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Fresh Variation
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate YouTube Metadata
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-xs md:text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Could not generate metadata</p>
            <p className="text-rose-300/90">{error}</p>
          </div>
        </div>
      )}

      {/* Generated Output Cards */}
      {result && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Meta Info Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Creative Angle Used:</span>
              <span className="text-indigo-300 font-medium bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                {result.angleUsed || "High-CTR Viral Framing"}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Variation #{generationCount} • Freshly generated
            </span>
          </div>

          {/* Primary Title & Alternative Titles */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Top Recommended Video Title
              </h3>
              <button
                type="button"
                onClick={() => copyToClipboard(result.primaryTitle, "primaryTitle")}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
              >
                {copiedField === "primaryTitle" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Title
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 text-base md:text-lg font-bold text-white">
              {result.primaryTitle}
            </div>

            {/* Alternative Hooks */}
            {result.alternativeTitles && result.alternativeTitles.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-slate-400">
                  Alternative High-CTR Title Angles (Click any to copy):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {result.alternativeTitles.map((alt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => copyToClipboard(alt, `alt-${i}`)}
                      className="text-left p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/90 transition flex items-center justify-between gap-3 group"
                    >
                      <span className="text-xs md:text-sm text-slate-200 font-medium">
                        {alt}
                      </span>
                      {copiedField === `alt-${i}` ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Hook Concept */}
          {result.thumbnailHook && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Suggested Thumbnail Concept &amp; Text Overlay
                  </h4>
                  <p className="text-sm text-slate-200 mt-1">{result.thumbnailHook}</p>
                </div>
              </div>
            </div>
          )}

          {/* Engaging Video Description */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                SEO-Optimized Video Description
              </h3>
              <button
                type="button"
                onClick={() => copyToClipboard(result.description, "description")}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
              >
                {copiedField === "description" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied Description!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Description
                  </>
                )}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm text-slate-200 bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 leading-relaxed max-h-96 overflow-y-auto">
              {result.description}
            </pre>
          </div>

          {/* SEO Tags */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                SEO-Friendly Tags ({result.tags?.length || 0} tags)
              </h3>
              <button
                type="button"
                onClick={() => copyToClipboard(result.tags.join(", "), "tags")}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
              >
                {copiedField === "tags" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied Comma-Separated Tags!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All Tags (CSV)
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {result.tags?.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => copyToClipboard(tag, `tag-${idx}`)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-indigo-500/20 text-slate-200 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <span>#{tag}</span>
                  {copiedField === `tag-${idx}` && (
                    <Check className="w-3 h-3 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
