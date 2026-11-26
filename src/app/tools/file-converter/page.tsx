import React from "react";
import type { Metadata } from "next";
import { Layers } from "lucide-react";
import BackButton from "@/components/BackButton";
import QuickToolNav from "@/components/QuickToolNav";
import ToolSeoContent from "@/components/ToolSeoContent";
import FileConverterWorkspace from "./FileConverterWorkspace";

export const metadata: Metadata = {
  title: "Free File Converter - Video, Audio & PDF (No Upload)",
  description:
    "Convert MP4, MP3, and PDF files instantly in your browser. 100% secure, private, and free with no file size limits. Try it now!",
  alternates: { canonical: "/tools/file-converter" },
};

export default function FileConverterPage() {
  return (
    <div className="flex-1 flex flex-col w-full bg-slate-950 text-slate-100">
      <main className="w-full flex-1 flex flex-col min-w-0">
        <div className="border-b border-slate-800/80 bg-slate-950/60">
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            <div>
              <BackButton />
            </div>

            <div className="flex flex-col gap-4 w-full min-w-0">
              <div className="flex flex-col gap-2 min-w-0 w-full">
                <div className="inline-flex items-start sm:items-center gap-2 text-xs font-medium text-indigo-400 leading-snug">
                  <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">
                    100% Client-Side Browser Media &amp; Document Studio
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight break-words">
                  Universal Client-Side File Converter
                </h1>
              </div>

              <QuickToolNav />
            </div>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
          <FileConverterWorkspace />

          <ToolSeoContent
            toolName="Universal Client-Side File Converter"
            aboutParagraphs={[
              "The Universal Client-Side File Converter lets you convert and compress videos, audio files, images, PDFs, and Word documents directly inside your web browser without uploading private files to external cloud servers. Built with FFmpeg WebAssembly, HTML5 Canvas, pdf-lib, PDF.js, and mammoth.js, every conversion runs locally on your own device for complete privacy and instant downloads.",
              "Whether you need to convert MP4 to MP3, compress large videos for WhatsApp or Discord, turn modern WebP and AVIF photos into JPG or PNG, or transform PDF and DOCX files, QuickConvert automatically detects each file's true format and gives you granular controls for quality, resolution, bitrate, resizing, and video trimming.",
            ]}
            howToSteps={[
              {
                title: "Drop One or Multiple Files",
                detail:
                  "Drag and drop video, audio, image, PDF, or document files into the upload zone above for automatic magic-byte format detection.",
              },
              {
                title: "Select Output Format & Options",
                detail:
                  "Pick your target format (MP4, WebM, MP3, WAV, PNG, JPG, WebP, PDF, TXT) and optionally adjust resolution, bitrate, quality, or trim points.",
              },
              {
                title: "Convert & Save Locally",
                detail:
                  "Click Convert to run the conversion locally inside your browser memory, then download your finished files immediately with zero upload queues.",
              },
            ]}
            highlights={[
              "Zero server uploads: your private videos, audio tracks, photos, and PDFs never leave your device.",
              "Batch conversion across video (MP4, WebM, MOV, MKV, GIF), audio (MP3, WAV, OGG, FLAC), images (PNG, JPG, WebP, AVIF, ICO), and documents (PDF, DOCX).",
              "Built-in video compressor, image quality slider, custom dimensions, and clip start/end trimming.",
              "100% free with no account sign-up, no file watermarks, and instant browser downloads.",
            ]}
          />
        </div>
      </main>
    </div>
  );
}
