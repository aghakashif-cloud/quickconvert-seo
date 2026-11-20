"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { useDropzone } from "react-dropzone";
import {
  Headphones,
  Upload,
  FileText,
  Play,
  Pause,
  Square,
  Volume2,
  Gauge,
  Loader2,
  ShieldCheck,
  Info,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  Sparkles,
  BookOpen,
} from "lucide-react";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Splits long text into natural sentence-sized chunks (~220 chars max) so
 * Chrome/Edge/Safari window.speechSynthesis never cuts off after 15 seconds.
 */
function splitTextIntoSpeechChunks(text: string, maxChunkLength = 220): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const para of paragraphs) {
    // Split on English, Urdu, Hindi, and Arabic sentence boundaries
    const sentences = para.split(/(?<=[.!?۔؟।])\s+/);

    let buffer = "";
    for (const sentence of sentences) {
      if (!sentence) continue;

      if ((buffer + " " + sentence).trim().length <= maxChunkLength) {
        buffer = (buffer + " " + sentence).trim();
      } else {
        if (buffer) {
          chunks.push(buffer);
          buffer = "";
        }

        if (sentence.length <= maxChunkLength) {
          buffer = sentence;
        } else {
          // Break very long sentences cleanly on word boundaries
          const words = sentence.split(/\s+/);
          let wordBuf = "";
          for (const word of words) {
            if ((wordBuf + " " + word).trim().length <= maxChunkLength) {
              wordBuf = (wordBuf + " " + word).trim();
            } else {
              if (wordBuf) chunks.push(wordBuf);
              wordBuf = word;
            }
          }
          if (wordBuf) buffer = wordBuf;
        }
      }
    }

    if (buffer) {
      chunks.push(buffer);
    }
  }

  return chunks;
}

function getVoicePriority(lang: string): number {
  const lower = lang.toLowerCase();
  if (lower.startsWith("en")) return 0;
  if (lower.startsWith("ur")) return 1;
  if (lower.startsWith("hi")) return 2;
  if (lower.startsWith("ar")) return 3;
  return 4;
}

export default function PdfToAudiobookPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<number>(0);
  const [extractStatus, setExtractStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [extractedText, setExtractedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // SpeechSynthesis state
  const [ttsSupported, setTtsSupported] = useState<boolean>(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [playbackState, setPlaybackState] = useState<
    "stopped" | "playing" | "paused"
  >("stopped");
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);

  // Refs for reliable chunked SpeechSynthesis playback
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const playbackRateRef = useRef<number>(1.0);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync refs when voice or rate changes
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    selectedVoiceRef.current =
      voices.find((v) => v.voiceURI === selectedVoiceURI) || null;
  }, [voices, selectedVoiceURI]);

  // Load browser SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTtsSupported(false);
      return;
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (!available || available.length === 0) return;

      const sorted = [...available].sort((a, b) => {
        const pDiff = getVoicePriority(a.lang) - getVoicePriority(b.lang);
        if (pDiff !== 0) return pDiff;
        return a.name.localeCompare(b.name);
      });

      setVoices(sorted);
      setSelectedVoiceURI((prev) => {
        if (prev && sorted.some((v) => v.voiceURI === prev)) return prev;
        const defaultEn =
          sorted.find((v) => v.default && v.lang.toLowerCase().startsWith("en")) ||
          sorted.find((v) => v.lang.toLowerCase().startsWith("en")) ||
          sorted[0];
        return defaultEn ? defaultEn.voiceURI : "";
      });
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const stopSpeech = useCallback(() => {
    playbackSessionRef.current += 1;
    isPlayingRef.current = false;
    isPausedRef.current = false;
    chunkIndexRef.current = 0;
    setCurrentChunkIndex(0);
    setPlaybackState("stopped");

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakChunkAtIndex = useCallback(
    (index: number, sessionId: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      if (sessionId !== playbackSessionRef.current) return;

      const chunks = chunksRef.current;
      if (index >= chunks.length) {
        isPlayingRef.current = false;
        isPausedRef.current = false;
        chunkIndexRef.current = 0;
        setCurrentChunkIndex(0);
        setPlaybackState("stopped");
        return;
      }

      chunkIndexRef.current = index;
      setCurrentChunkIndex(index + 1);

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = playbackRateRef.current;
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
        utterance.lang = selectedVoiceRef.current.lang;
      }

      utterance.onend = () => {
        if (sessionId !== playbackSessionRef.current) return;
        if (isPlayingRef.current && !isPausedRef.current) {
          speakChunkAtIndex(index + 1, sessionId);
        }
      };

      utterance.onerror = (event) => {
        if (sessionId !== playbackSessionRef.current) return;
        // Ignore intentional cancel/interrupted errors
        if (event.error === "canceled" || event.error === "interrupted") {
          return;
        }
        isPlayingRef.current = false;
        isPausedRef.current = false;
        setPlaybackState("stopped");
        setError(
          `Speech playback error (${event.error}). Try selecting a different browser voice.`
        );
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const handlePlay = () => {
    if (!ttsSupported) {
      setError(
        "Your browser does not support the Web Speech API (window.speechSynthesis)."
      );
      return;
    }

    const trimmed = extractedText.trim();
    if (!trimmed) {
      setError("Please upload a PDF or enter some text first to listen.");
      return;
    }

    setError(null);

    // Resume if paused
    if (playbackState === "paused" && isPausedRef.current) {
      isPausedRef.current = false;
      isPlayingRef.current = true;
      setPlaybackState("playing");
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        // Fallback if browser dropped paused queue: continue from current chunk
        const nextSession = playbackSessionRef.current + 1;
        playbackSessionRef.current = nextSession;
        window.speechSynthesis.cancel();
        speakChunkAtIndex(chunkIndexRef.current, nextSession);
      }
      return;
    }

    // Start fresh playback
    const chunks = splitTextIntoSpeechChunks(trimmed);
    if (chunks.length === 0) return;

    chunksRef.current = chunks;
    setTotalChunks(chunks.length);
    chunkIndexRef.current = 0;

    const nextSession = playbackSessionRef.current + 1;
    playbackSessionRef.current = nextSession;
    isPlayingRef.current = true;
    isPausedRef.current = false;
    setPlaybackState("playing");

    window.speechSynthesis.cancel();
    speakChunkAtIndex(0, nextSession);
  };

  const handlePause = () => {
    if (playbackState !== "playing") return;
    isPausedRef.current = true;
    setPlaybackState("paused");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  };

  const handleRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
    playbackRateRef.current = newRate;

    // If actively speaking, smoothly restart current chunk with the new playback rate
    if (playbackState === "playing" && isPlayingRef.current && !isPausedRef.current) {
      const nextSession = playbackSessionRef.current + 1;
      playbackSessionRef.current = nextSession;
      window.speechSynthesis.cancel();
      speakChunkAtIndex(chunkIndexRef.current, nextSession);
    }
  };

  const handleVoiceChange = (newVoiceURI: string) => {
    setSelectedVoiceURI(newVoiceURI);
    const chosen = voices.find((v) => v.voiceURI === newVoiceURI) || null;
    selectedVoiceRef.current = chosen;

    if (playbackState === "playing" && isPlayingRef.current && !isPausedRef.current) {
      const nextSession = playbackSessionRef.current + 1;
      playbackSessionRef.current = nextSession;
      window.speechSynthesis.cancel();
      speakChunkAtIndex(chunkIndexRef.current, nextSession);
    }
  };

  const extractTextFromPdf = async (file: File) => {
    stopSpeech();
    setPdfFile(file);
    setPageCount(0);
    setExtractedText("");
    setError(null);
    setExtracting(true);
    setExtractProgress(10);
    setExtractStatus("Loading local PDF.js engine...");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;

      setExtractStatus("Reading PDF document locally in browser memory...");
      setExtractProgress(20);
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPageCount(pdf.numPages);

      const pageTexts: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setExtractStatus(`Extracting text from page ${pageNum} of ${pdf.numPages}...`);
        setExtractProgress(
          Math.min(95, Math.round(20 + (pageNum / pdf.numPages) * 75))
        );

        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        let pageStr = "";
        let lastY: number | null = null;

        for (const item of textContent.items) {
          if (!("str" in item)) continue;
          const textItem = item as { str: string; transform?: number[] };
          const currentY =
            Array.isArray(textItem.transform) && textItem.transform.length >= 6
              ? Math.round(textItem.transform[5])
              : null;

          if (
            lastY !== null &&
            currentY !== null &&
            Math.abs(currentY - lastY) > 16
          ) {
            pageStr += "\n";
          } else if (pageStr && !pageStr.endsWith(" ") && !pageStr.endsWith("\n")) {
            pageStr += " ";
          }

          pageStr += textItem.str;
          if (currentY !== null) {
            lastY = currentY;
          }
        }

        const cleanedPage = pageStr
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        if (cleanedPage) {
          pageTexts.push(cleanedPage);
        }
      }

      const combined = pageTexts.join("\n\n").trim();

      if (!combined) {
        setError(
          "No selectable text was found in this PDF. It may be a scanned image-only PDF without an embedded text layer."
        );
      } else {
        setExtractedText(combined);
      }

      setExtractProgress(100);
      setExtractStatus(
        `Extracted text from ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"} 100% locally!`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Could not read PDF: ${err.message}`
          : "Failed to extract text from this PDF file."
      );
    } finally {
      setExtracting(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      extractTextFromPdf(acceptedFiles[0]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const handleReset = () => {
    stopSpeech();
    setPdfFile(null);
    setPageCount(0);
    setExtractedText("");
    setExtractProgress(0);
    setExtractStatus("");
    setError(null);
    setTotalChunks(0);
  };

  const handleCopyText = async () => {
    if (!extractedText.trim()) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const wordCount = extractedText.trim()
    ? extractedText.trim().split(/\s+/).length
    : 0;
  // Average speech speed ~155 words/min at 1.0x
  const estimatedMinutes =
    wordCount > 0
      ? Math.max(1, Math.round(wordCount / (155 * playbackRate)))
      : 0;

  const listenProgressPct =
    totalChunks > 0 && currentChunkIndex > 0
      ? Math.min(100, Math.round((currentChunkIndex / totalChunks) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-cyan-400" />
              100% Client-Side PDF Text-to-Speech Reader
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              PDF to Audiobook (Text-to-Speech)
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Drop any PDF book, study guide, or report to extract its text locally and listen to it aloud with adjustable speed and natural browser voices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/?tab=converter&mode=document"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Document Converter
            </Link>
            <Link
              href="/tools/audio-transcriber"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              AI Audio Transcriber
            </Link>
            <Link
              href="/?tab=youtube"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              YouTube AI Studio
            </Link>
          </div>
        </div>

        {/* Privacy Badge + Required Local Playback Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-emerald-300">
              100% Private: Your PDF documents never leave your device. Text extraction runs strictly in your browser.
            </p>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <p className="text-xs font-medium text-indigo-200">
              Audio is generated locally in your browser. You can listen to it directly, but downloading as an MP3 is not supported yet.
            </p>
          </div>
        </div>

        {/* Browser TTS Support Warning */}
        {!ttsSupported && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Your current browser does not support the Web Speech API (<code>window.speechSynthesis</code>). Try Chrome, Edge, or Safari to listen to extracted PDF text.
            </span>
          </div>
        )}

        {/* Drag & Drop PDF Upload Zone */}
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 md:p-11 text-center ${
            isDragActive
              ? "border-cyan-400 bg-cyan-500/10 scale-[0.995]"
              : "border-slate-700/80 hover:border-indigo-500/70 bg-slate-900/50 hover:bg-slate-900/80"
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center mb-3.5">
            {extracting ? (
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
            ) : (
              <Upload className="w-7 h-7 text-indigo-400" />
            )}
          </div>
          <h2 className="text-base md:text-lg font-bold text-slate-100">
            {isDragActive
              ? "Drop your PDF document here..."
              : pdfFile
              ? `Loaded: ${pdfFile.name} (${formatBytes(pdfFile.size)})`
              : "Drag & Drop a PDF Document to Listen"}
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xl mx-auto">
            {extracting
              ? extractStatus
              : "Upload any text-based PDF (ebooks, research papers, lecture notes, contracts) to extract its text and turn it into an instant audiobook."}
          </p>

          {extracting ? (
            <div className="max-w-md mx-auto mt-4 space-y-1.5">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
                  style={{ width: `${extractProgress}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-cyan-300">
                {extractProgress}%
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-600/25 transition">
                <BookOpen className="w-4 h-4" />
                {pdfFile ? "Upload a Different PDF" : "Choose PDF File"}
              </span>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5 text-xs md:text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Audiobook Player Controls + Editable Text Area */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-7 space-y-6 shadow-xl">
          {/* Player Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Audiobook Player Controls
                </h2>
                <p className="text-xs text-slate-400">
                  {wordCount > 0 ? (
                    <>
                      {pageCount > 0 && `${pageCount} page${pageCount === 1 ? "" : "s"} • `}
                      {wordCount.toLocaleString()} words • ~{estimatedMinutes} min listen at{" "}
                      {playbackRate.toFixed(2).replace(/\.00$/, ".0")}x
                    </>
                  ) : (
                    "Upload a PDF above or paste text below to start listening"
                  )}
                </p>
              </div>
            </div>

            {/* Play / Pause / Stop Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePlay}
                disabled={
                  !ttsSupported ||
                  extracting ||
                  !extractedText.trim() ||
                  playbackState === "playing"
                }
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                {playbackState === "paused" ? "Resume" : "Play"}
              </button>

              <button
                type="button"
                onClick={handlePause}
                disabled={playbackState !== "playing"}
                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/35 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>

              <button
                type="button"
                onClick={stopSpeech}
                disabled={playbackState === "stopped"}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-200 border border-rose-500/35 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
            </div>
          </div>

          {/* Voice Selector & Speed Slider Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Voice / Language Dropdown */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2">
              <label
                htmlFor="tts-voice-select"
                className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Voice &amp; Language ({voices.length} browser voice
                {voices.length === 1 ? "" : "s"})
              </label>
              <select
                id="tts-voice-select"
                value={selectedVoiceURI}
                onChange={(e) => handleVoiceChange(e.target.value)}
                disabled={voices.length === 0}
                className="w-full bg-slate-900 border border-slate-700 hover:border-indigo-500/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg px-3 py-2.5 text-xs text-slate-100 transition"
              >
                {voices.length === 0 ? (
                  <option value="">Loading browser voices...</option>
                ) : (
                  voices.map((voice) => (
                    <option
                      key={voice.voiceURI}
                      value={voice.voiceURI}
                      className="bg-slate-900 text-slate-100"
                    >
                      {voice.name} ({voice.lang})
                      {voice.default ? " — Default" : ""}
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-slate-400">
                Available English, Urdu, Hindi, and system voices depend on your browser and OS.
              </p>
            </div>

            {/* Speed Control Slider (0.5x to 2x) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="tts-speed-slider"
                  className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  Reading Speed
                </label>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {playbackRate.toFixed(2).replace(/\.00$/, ".0")}x
                </span>
              </div>

              <input
                id="tts-speed-slider"
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={playbackRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>0.5x (Slow)</span>
                <div className="flex items-center gap-1.5">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleRateChange(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        Math.abs(playbackRate - preset) < 0.05
                          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
                <span>2.0x (Fast)</span>
              </div>
            </div>
          </div>

          {/* Live Reading Progress Bar */}
          {playbackState !== "stopped" && totalChunks > 0 && (
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      playbackState === "playing"
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  />
                  {playbackState === "playing"
                    ? `Reading segment ${currentChunkIndex} of ${totalChunks}...`
                    : `Paused at segment ${currentChunkIndex} of ${totalChunks}`}
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {listenProgressPct}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${listenProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Extracted Text Editable Scrollable Textarea */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="pdf-extracted-textarea"
                className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                Extracted PDF Text (Editable)
              </label>

              <div className="flex items-center gap-2">
                {extractedText.trim() && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Text
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-xs font-semibold text-slate-300 hover:text-rose-300 border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            <textarea
              id="pdf-extracted-textarea"
              dir="auto"
              rows={12}
              value={extractedText}
              onChange={(e) => {
                if (playbackState !== "stopped") stopSpeech();
                setExtractedText(e.target.value);
              }}
              placeholder="Upload a PDF above to extract its text automatically, or paste any text here to listen right away. You can freely edit or remove headers/footnotes before clicking Play."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y overflow-y-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
