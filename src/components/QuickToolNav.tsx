"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Sparkles,
  Film,
  ImageDown,
  BarChart3,
  Scissors,
  Mic,
  Headphones,
  Wand2,
  Files,
  Images,
  Percent,
  AlignLeft,
  KeyRound,
  Globe,
  Landmark,
  Box,
} from "lucide-react";

const TOOL_LINKS = [
  {
    href: "/tools/file-converter",
    matchPaths: ["/", "/tools/file-converter"],
    label: "File Converter",
    icon: ShieldCheck,
    activeClass: "bg-indigo-600 text-white shadow",
    iconClass: "text-indigo-400",
  },
  {
    href: "/tools/youtube-ai-studio",
    matchPaths: ["/tools/youtube-ai-studio"],
    label: "YouTube AI Studio",
    icon: Sparkles,
    activeClass: "bg-rose-600 text-white shadow",
    iconClass: "text-rose-400",
  },
  {
    href: "/tools/video-to-gif",
    matchPaths: ["/tools/video-to-gif"],
    label: "Video to GIF",
    icon: Film,
    activeClass: "bg-purple-600 text-white shadow",
    iconClass: "text-purple-400",
  },
  {
    href: "/tools/thumbnail-downloader",
    matchPaths: ["/tools/thumbnail-downloader"],
    label: "Thumbnail Downloader",
    icon: ImageDown,
    activeClass: "bg-emerald-600 text-white shadow",
    iconClass: "text-emerald-400",
  },
  {
    href: "/tools/youtube-seo-audit",
    matchPaths: ["/tools/youtube-seo-audit"],
    label: "YouTube SEO Audit",
    icon: BarChart3,
    activeClass: "bg-amber-600 text-white shadow",
    iconClass: "text-amber-400",
  },
  {
    href: "/tools/ai-video-clipper",
    matchPaths: ["/tools/ai-video-clipper"],
    label: "AI Video Clipper",
    icon: Scissors,
    activeClass: "bg-indigo-600 text-white shadow",
    iconClass: "text-indigo-400",
  },
  {
    href: "/tools/ai-transcriber",
    matchPaths: ["/tools/ai-transcriber"],
    label: "AI Transcriber",
    icon: Mic,
    activeClass: "bg-cyan-600 text-white shadow",
    iconClass: "text-cyan-400",
  },
  {
    href: "/tools/pdf-to-audiobook",
    matchPaths: ["/tools/pdf-to-audiobook"],
    label: "PDF to Audiobook",
    icon: Headphones,
    activeClass: "bg-indigo-600 text-white shadow",
    iconClass: "text-indigo-400",
  },
  {
    href: "/tools/merge-pdf",
    matchPaths: ["/tools/merge-pdf"],
    label: "Merge PDF",
    icon: Files,
    activeClass: "bg-rose-600 text-white shadow",
    iconClass: "text-rose-400",
  },
  {
    href: "/tools/merge-images",
    matchPaths: ["/tools/merge-images"],
    label: "Merge Images",
    icon: Images,
    activeClass: "bg-emerald-600 text-white shadow",
    iconClass: "text-emerald-400",
  },
  {
    href: "/tools/video-to-seo",
    matchPaths: ["/tools/video-to-seo"],
    label: "Video-to-SEO Generator",
    icon: Wand2,
    activeClass: "bg-rose-600 text-white shadow",
    iconClass: "text-rose-400",
  },
  {
    href: "/tools/image-to-3d",
    matchPaths: ["/tools/image-to-3d"],
    label: "Image to 3D",
    icon: Box,
    activeClass: "bg-purple-600 text-white shadow",
    iconClass: "text-purple-400",
  },
  {
    href: "/tools/percentage-calculator",
    matchPaths: ["/tools/percentage-calculator"],
    label: "Percentage Calculator",
    icon: Percent,
    activeClass: "bg-indigo-600 text-white shadow",
    iconClass: "text-indigo-400",
  },
  {
    href: "/tools/word-counter",
    matchPaths: ["/tools/word-counter"],
    label: "Word Counter",
    icon: AlignLeft,
    activeClass: "bg-cyan-600 text-white shadow",
    iconClass: "text-cyan-400",
  },
  {
    href: "/tools/password-generator",
    matchPaths: ["/tools/password-generator"],
    label: "Password Generator",
    icon: KeyRound,
    activeClass: "bg-emerald-600 text-white shadow",
    iconClass: "text-emerald-400",
  },
  {
    href: "/tools/currency-converter",
    matchPaths: ["/tools/currency-converter"],
    label: "Currency Converter",
    icon: Globe,
    activeClass: "bg-indigo-600 text-white shadow",
    iconClass: "text-indigo-400",
  },
  {
    href: "/tools/tax-calculator",
    matchPaths: ["/tools/tax-calculator"],
    label: "Tax Calculator",
    icon: Landmark,
    activeClass: "bg-amber-600 text-white shadow",
    iconClass: "text-amber-400",
  },
];

export default function QuickToolNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Quick Tool Switcher"
      className="w-full mt-1 mb-1 flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl"
    >
      {TOOL_LINKS.map((tool) => {
        const Icon = tool.icon;
        const isActive = tool.matchPaths.includes(pathname);
        return (
          <Link
            key={tool.href}
            href={tool.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
              isActive
                ? tool.activeClass
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 shrink-0 ${
                isActive ? "text-white" : tool.iconClass
              }`}
            />
            <span>{tool.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
