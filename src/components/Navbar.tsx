"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  ChevronDown,
  Menu,
  X,
  FileVideo,
  FileAudio,
  FileImage,
  FileText,
  Youtube,
  Sparkles,
  Minimize2,
  Building2,
  Mail,
  Shield,
  Scale,
  AlertTriangle,
  ArrowRight,
  Film,
  ImageDown,
  BarChart3,
  Scissors,
  Mic,
  Headphones,
} from "lucide-react";

interface NavDropdownItem {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

interface NavCategory {
  title: string;
  items: NavDropdownItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    title: "Convert",
    items: [
      {
        label: "Video Converter",
        description: "MP4, WebM, MOV, AVI, MKV & GIF via FFmpeg WASM",
        href: "/?tab=converter&mode=video",
        icon: <FileVideo className="w-4 h-4 text-indigo-400" />,
      },
      {
        label: "Audio Converter",
        description: "MP3, WAV, OGG, M4A & FLAC audio transcoding",
        href: "/?tab=converter&mode=audio",
        icon: <FileAudio className="w-4 h-4 text-amber-400" />,
      },
      {
        label: "Image Converter",
        description: "PNG, JPG, WebP, AVIF, BMP, ICO & Image to PDF",
        href: "/?tab=converter&mode=image",
        icon: <FileImage className="w-4 h-4 text-emerald-400" />,
      },
      {
        label: "Document Converter",
        description: "PDF to PNG/JPG/TXT & DOCX/Text to PDF",
        href: "/?tab=converter&mode=document",
        icon: <FileText className="w-4 h-4 text-cyan-400" />,
      },
      {
        label: "Video to GIF Converter",
        description: "Convert MP4, MOV & WebM clips into animated GIFs",
        href: "/tools/video-to-gif",
        icon: <Film className="w-4 h-4 text-purple-400" />,
      },
      {
        label: "PDF to Audiobook (TTS)",
        description: "Listen to any PDF aloud locally with browser Text-to-Speech",
        href: "/tools/pdf-to-audiobook",
        icon: <Headphones className="w-4 h-4 text-cyan-400" />,
      },
    ],
  },
  {
    title: "AI Tools",
    items: [
      {
        label: "YouTube Metadata Generator",
        description: "Complete SEO descriptions, chapters, and viral tags",
        href: "/?tab=youtube&mode=metadata",
        icon: <Youtube className="w-4 h-4 text-rose-400" />,
      },
      {
        label: "AI Title Generator",
        description: "High-CTR YouTube titles & thumbnail hook ideas",
        href: "/?tab=youtube&mode=titles",
        icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      },
      {
        label: "YouTube Thumbnail Downloader",
        description: "Download HD & 4K YouTube thumbnails (maxresdefault)",
        href: "/tools/thumbnail-downloader",
        icon: <ImageDown className="w-4 h-4 text-emerald-400" />,
      },
      {
        label: "YouTube SEO Audit & Analyzer",
        description: "Audit any video URL for a 0-100 SEO score & fixes",
        href: "/tools/youtube-audit",
        icon: <BarChart3 className="w-4 h-4 text-amber-400" />,
      },
      {
        label: "AI Video Clipper",
        description: "Extract audio locally & find 30-60s viral Shorts segments",
        href: "/tools/ai-video-clipper",
        icon: <Scissors className="w-4 h-4 text-indigo-400" />,
      },
      {
        label: "AI Audio/Video Transcriber",
        description: "Transcribe audio & video locally in-browser with Whisper AI",
        href: "/tools/audio-transcriber",
        icon: <Mic className="w-4 h-4 text-cyan-400" />,
      },
    ],
  },
  {
    title: "Compress",
    items: [
      {
        label: "Compress Video",
        description: "Reduce video size with custom bitrate & resolution",
        href: "/?tab=converter&mode=compress-video",
        icon: <Minimize2 className="w-4 h-4 text-indigo-400" />,
      },
      {
        label: "Compress Image",
        description: "Optimize PNG, JPG, and WebP with quality slider",
        href: "/?tab=converter&mode=compress-image",
        icon: <FileImage className="w-4 h-4 text-emerald-400" />,
      },
    ],
  },
  {
    title: "Company",
    items: [
      {
        label: "About Us",
        description: "Our mission & privacy-first browser architecture",
        href: "/about",
        icon: <Building2 className="w-4 h-4 text-indigo-400" />,
      },
      {
        label: "Contact",
        description: "Get in touch with our support & product team",
        href: "/contact",
        icon: <Mail className="w-4 h-4 text-emerald-400" />,
      },
      {
        label: "Privacy Policy",
        description: "Zero-upload guarantee, cookies & AdSense policy",
        href: "/privacy-policy",
        icon: <Shield className="w-4 h-4 text-amber-400" />,
      },
      {
        label: "Terms & Conditions",
        description: "Terms of service & usage guidelines",
        href: "/terms",
        icon: <Scale className="w-4 h-4 text-cyan-400" />,
      },
      {
        label: "Disclaimer",
        description: "Legal notices for local conversion & AI outputs",
        href: "/disclaimer",
        icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      },
    ],
  },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>("Convert");

  const toggleMobileCategory = (title: string) => {
    setOpenMobileCategory((prev) => (prev === title ? null : title));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Name */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2.5 sm:gap-3 group min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-white group-hover:text-indigo-300 transition block leading-snug truncate">
              QuickConvert <span className="text-indigo-400">&amp; SEO Tools</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block leading-tight truncate">
              All-in-One File Converter &amp; AI SEO Suite
            </span>
          </div>
        </Link>

        {/* Center / Right: Desktop Hover Dropdown Menus */}
        <nav
          aria-label="Global SaaS Navigation"
          className="hidden lg:flex items-center gap-1"
        >
          {NAV_CATEGORIES.map((category) => (
            <div key={category.title} className="relative group">
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 group-hover:text-white group-hover:bg-slate-800/80 transition flex items-center gap-1.5"
              >
                <span>{category.title}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 group-hover:rotate-180 transition-transform duration-200" />
              </button>

              {/* Dropdown Panel */}
              <div className="invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 ease-out absolute left-0 top-full pt-2 w-72 z-50">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 p-2 space-y-1">
                  {category.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/90 transition group/item"
                    >
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 group-hover/item:border-indigo-500/40 transition shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 group-hover/item:text-indigo-300 transition flex items-center gap-1">
                          <span>{item.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Link
            href="/blog"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition"
          >
            Blog
          </Link>
        </nav>

        {/* Right: Quick Action CTA Buttons (Desktop) */}
        <div className="hidden lg:flex items-center gap-2.5">
          <Link
            href="/?tab=converter"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 transition"
          >
            File Converter
          </Link>
          <Link
            href="/?tab=youtube"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            YouTube AI Studio
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Full-Screen / Slide-Down Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-slate-950/98 backdrop-blur-xl border-t border-slate-800 overflow-y-auto z-50 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-800">
            <Link
              href="/?tab=converter"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-xs font-bold text-indigo-200 text-center flex items-center justify-center gap-1.5"
            >
              <FileVideo className="w-4 h-4 text-indigo-400" />
              Converter
            </Link>
            <Link
              href="/?tab=youtube"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-xs font-bold text-rose-200 text-center flex items-center justify-center gap-1.5"
            >
              <Youtube className="w-4 h-4 text-rose-400" />
              YouTube AI
            </Link>
            <Link
              href="/blog"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-xs font-bold text-emerald-200 text-center flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              Blog
            </Link>
          </div>

          <div className="space-y-2.5">
            {NAV_CATEGORIES.map((category) => {
              const isOpen = openMobileCategory === category.title;
              return (
                <div
                  key={category.title}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleMobileCategory(category.title)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between text-sm font-bold text-slate-100"
                  >
                    <span>{category.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180 text-indigo-400" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-1 border-t border-slate-800/70">
                      {category.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-100">
                                {item.label}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
