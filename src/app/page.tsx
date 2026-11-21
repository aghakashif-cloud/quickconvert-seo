import React from "react";
import { Layers } from "lucide-react";
import QuickToolNav from "@/components/QuickToolNav";
import ToolSeoContent from "@/components/ToolSeoContent";
import FileConverterWorkspace from "./tools/file-converter/FileConverterWorkspace";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col w-full bg-slate-950 text-slate-100">
      {/* Main Full-Width Content Area */}
      <main className="w-full flex-1 flex flex-col min-w-0">
        {/* Centered Workspace Sub-Header Bar */}
        <div className="border-b border-slate-800/80 bg-slate-950/60">
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            <div className="flex flex-col gap-4 w-full min-w-0">
              <div className="flex flex-col gap-2 min-w-0 w-full">
                <div className="inline-flex items-start sm:items-center gap-2 text-xs font-medium text-indigo-400 leading-snug">
                  <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">
                    Tool 01 / Local Browser Media &amp; Document Studio
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight break-words">
                  Universal Client-Side File Converter
                </h1>
              </div>

              {/* Clean Route Quick Tool Switcher with active pathname highlighting */}
              <QuickToolNav />
            </div>
          </div>
        </div>

        {/* Centered Active Tool Workspace */}
        <div className="px-4 py-6 sm:px-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
          <FileConverterWorkspace />

          <ToolSeoContent
            toolName="QuickConvert Universal File Converter"
            aboutParagraphs={[
              "QuickConvert Universal Client-Side File Converter lets you transform videos, audio tracks, images, PDFs, and Word documents directly inside your web browser without uploading a single byte to external cloud servers. Powered by FFmpeg WebAssembly, HTML5 Canvas, pdf-lib, and mammoth.js, every conversion runs locally on your own device for complete privacy and instant downloads.",
              "Whether you need to convert MP4 to MP3, compress large videos for WhatsApp or Discord, turn iPhone HEIC and WebP photos into standard JPG or PNG files, or convert PDF and DOCX documents, QuickConvert automatically detects your file type and displays every compatible output format along with optional resolution, quality, bitrate, and trim controls.",
            ]}
            howToSteps={[
              {
                title: "Add Your Files",
                detail:
                  "Drag and drop one or multiple video, audio, image, PDF, or document files into the dropzone above.",
              },
              {
                title: "Choose an Output Format",
                detail:
                  "Select your target format (such as MP4, MP3, WebP, JPG, PNG, or PDF) and optionally adjust resolution, bitrate, quality, or trim times.",
              },
              {
                title: "Convert & Download Locally",
                detail:
                  "Click Convert to process files directly in your browser memory, then save the finished output immediately with zero upload wait time.",
              },
            ]}
            highlights={[
              "100% private client-side file conversion—your personal videos, photos, and PDFs never leave your device.",
              "Supports batch file conversion across video (MP4, WebM, MOV, MKV), audio (MP3, WAV, FLAC), images (PNG, JPG, WebP, AVIF, ICO), and documents (PDF, DOCX).",
              "Built-in YouTube Creator Suite including AI Transcriber, Video-to-SEO Generator, YouTube SEO Audit, AI Video Clipper, and Thumbnail Downloader.",
              "Completely free with no account registration, no watermarks, and instant browser downloads.",
            ]}
          />
        </div>
      </main>
    </div>
  );
}
