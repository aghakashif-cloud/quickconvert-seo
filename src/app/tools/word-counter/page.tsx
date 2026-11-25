"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  FileText,
  Copy,
  Check,
  Trash2,
  Clock,
  ShieldCheck,
  Sparkles,
  AlignLeft,
} from "lucide-react";

const PLATFORM_LIMITS = [
  { label: "SEO Title Tag", limit: 60 },
  { label: "YouTube Title", limit: 100 },
  { label: "Meta Description", limit: 160 },
  { label: "X / Twitter Post", limit: 280 },
];

export default function WordCounterPage() {
  const [text, setText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const charsWithSpaces = text.length;
    const charsWithoutSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed
      ? trimmed
          .split(/[.!?۔؟।]+(?:\s+|$)/)
          .map((s) => s.trim())
          .filter(Boolean).length
      : 0;
    const paragraphs = trimmed
      ? trimmed
          .split(/\n\s*\n+/)
          .map((p) => p.trim())
          .filter(Boolean).length
      : 0;

    // Average reading ~200 wpm, speaking ~130 wpm
    const readingSec = words > 0 ? Math.ceil((words / 200) * 60) : 0;
    const speakingSec = words > 0 ? Math.ceil((words / 130) * 60) : 0;

    const formatTime = (secs: number) => {
      if (secs === 0) return "0s";
      if (secs < 60) return `${secs}s`;
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
    };

    return {
      words,
      charsWithSpaces,
      charsWithoutSpaces,
      sentences,
      paragraphs,
      readingTime: formatTime(readingSec),
      speakingTime: formatTime(speakingSec),
    };
  }, [text]);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const transformCase = (mode: "upper" | "lower" | "title" | "sentence") => {
    if (!text) return;
    if (mode === "upper") {
      setText(text.toUpperCase());
    } else if (mode === "lower") {
      setText(text.toLowerCase());
    } else if (mode === "title") {
      setText(
        text
          .toLowerCase()
          .replace(/(^|\s)\S/g, (char) => char.toUpperCase())
      );
    } else {
      setText(
        text
          .toLowerCase()
          .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase())
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlignLeft className="w-4 h-4" />
              Utilities • Real-Time Text Analyzer
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Word &amp; Character Counter
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Count words, characters (with and without spaces), sentences, paragraphs, and reading time in real time as you type—100% locally in your browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/percentage-calculator"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Percentage Calculator
            </Link>
            <Link
              href="/tools/password-generator"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Password Generator
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

        {/* Privacy Notice */}
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center justify-center gap-2.5 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-xs md:text-sm font-medium text-emerald-300">
            100% Private: Your drafts, essays, and scripts stay strictly in your browser—never sent to any server.
          </p>
        </div>

        {/* Live Counter Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Words
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white font-mono mt-1">
              {stats.words.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">
              Characters
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white font-mono mt-1">
              {stats.charsWithSpaces.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              No Spaces
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white font-mono mt-1">
              {stats.charsWithoutSpaces.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Sentences
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white font-mono mt-1">
              {stats.sentences.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Paragraphs
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white font-mono mt-1">
              {stats.paragraphs.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Main Text Editor Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <FileText className="w-4 h-4 text-cyan-400" />
                Text Input
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Read: <strong className="text-slate-200">{stats.readingTime}</strong>
              </span>
              <span className="flex items-center gap-1">
                Speak: <strong className="text-slate-200">{stats.speakingTime}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!text}
                onClick={() => transformCase("sentence")}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
              >
                Sentence case
              </button>
              <button
                type="button"
                disabled={!text}
                onClick={() => transformCase("title")}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
              >
                Title Case
              </button>
              <button
                type="button"
                disabled={!text}
                onClick={() => transformCase("upper")}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
              >
                UPPER
              </button>
              <button
                type="button"
                disabled={!text}
                onClick={() => transformCase("lower")}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
              >
                lower
              </button>
              <button
                type="button"
                disabled={!text}
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!text}
                onClick={() => setText("")}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-semibold text-slate-300 hover:text-rose-300 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          <textarea
            aria-label="Text to count words and characters"
            dir="auto"
            rows={11}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start typing or paste your essay, blog post, YouTube description, or social caption here to see instant word, character, sentence, and paragraph counts..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
          />

          {/* SEO & Social Character Limit Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {PLATFORM_LIMITS.map((item) => {
              const pct = Math.min(
                100,
                Math.round((stats.charsWithSpaces / item.limit) * 100)
              );
              const isOver = stats.charsWithSpaces > item.limit;
              return (
                <div
                  key={item.label}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">
                      {item.label}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isOver ? "text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {stats.charsWithSpaces}/{item.limit}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOver
                          ? "bg-rose-500"
                          : pct >= 85
                          ? "bg-amber-400"
                          : "bg-cyan-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <ToolSeoContent
          toolName="Word & Character Counter"
          aboutParagraphs={[
            "Our free Word & Character Counter gives writers, students, SEO specialists, and social media managers instant real-time statistics as they type or paste text. Track total words, characters with spaces, characters excluding spaces, sentences, paragraphs, and estimated reading and speaking times directly inside your browser without sending your drafts to any server.",
            "Built-in character limit meters help you keep Google SEO titles under 60 characters, meta descriptions under 160 characters, YouTube titles under 100 characters, and X posts under 280 characters—while quick case converters let you format headings in one click.",
          ]}
          howToSteps={[
            {
              title: "Type or Paste Your Text",
              detail:
                "Click inside the editor box above and start typing or paste any article, essay, video script, or caption.",
            },
            {
              title: "Check Live Metrics & SEO Limits",
              detail:
                "Watch word count, characters (with and without spaces), sentences, paragraphs, reading time, and platform gauges update on every keystroke.",
            },
            {
              title: "Format & Copy Your Draft",
              detail:
                "Use the quick Sentence case, Title Case, UPPER, or lower buttons if needed, then click Copy to move your finished text to your clipboard.",
            },
          ]}
          highlights={[
            "Real-time counting for words, characters with spaces, characters without spaces, sentences, and paragraphs.",
            "Estimated reading time (200 WPM) and speaking time (130 WPM) for presentations and YouTube video scripts.",
            "Live SEO and social limit indicators (60-char Title, 100-char YouTube Title, 160-char Meta Description, 280-char X post).",
            "Supports right-to-left scripts (Urdu, Arabic, Persian) automatically and runs 100% privately inside your browser.",
          ]}
        />
      </div>
    </div>
  );
}
