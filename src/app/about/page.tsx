import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, Cpu, Sparkles, Globe, Lock } from "lucide-react";

export const metadata = {
  title: "About Us | QuickConvert & SEO Tools",
  description:
    "Learn about QuickConvert & SEO Tools and our mission to deliver fast, privacy-first browser file conversion and AI creator SEO utilities.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-10">

        {/* Hero Section */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            About QuickConvert &amp; SEO Tools
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Empowering Creators with Privacy-First Web Utilities
          </h1>
          <p className="text-slate-400 leading-relaxed text-sm md:text-base">
            Welcome to <strong className="text-slate-200">QuickConvert &amp; SEO Tools</strong>, a modern multi-tool web platform engineered for digital creators, video editors, developers, and everyday internet users. Our mission is simple: deliver studio-grade media conversion and AI content workflows directly inside your web browser—without compromising your privacy or forcing you to upload sensitive files to third-party servers.
          </p>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              100% Client-Side File Conversion
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Unlike traditional online converters that upload your personal videos, audio recordings, PDFs, and photos to remote cloud storage, QuickConvert &amp; SEO Tools processes your files locally on your device using WebAssembly (FFmpeg WASM) and the HTML5 Canvas API. Your files never leave your computer.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              AI-Powered YouTube SEO Studio
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We integrate Google&apos;s latest Gemini AI models to help video creators overcome creative block. With a single topic or transcript, our AI studio generates high-click-through-rate (CTR) titles, structured chapter descriptions, thumbnail concepts, and search-optimized tags tailored to your audience.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Modern Web Architecture
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Built with Next.js App Router, TypeScript, and Tailwind CSS, QuickConvert &amp; SEO Tools combines native-speed browser execution with a clean, responsive, distraction-free interface that works across desktop and mobile devices.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Free &amp; Accessible for Everyone
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We believe essential digital utilities should be accessible without steep subscription paywalls or mandatory account sign-ups. Open QuickConvert &amp; SEO Tools in your browser and get your work done immediately.
            </p>
          </div>
        </div>

        {/* Our Story & Commitment */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            <span>Our Commitment to Security &amp; Transparency</span>
          </div>
          <h2 className="text-xl font-bold text-white">Why We Built QuickConvert &amp; SEO Tools</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Content creators and professionals convert dozens of media files and documents every week. However, uploading confidential client documents, unreleased video footage, or personal images to unknown cloud servers poses serious privacy risks and wastes bandwidth. By bringing WebAssembly transcoding, PDF rendering, and document parsing directly to the client browser, QuickConvert &amp; SEO Tools eliminates upload wait times and guarantees complete data ownership.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Have feedback, feature requests, or partnership inquiries? Visit our{" "}
            <Link href="/contact" className="text-indigo-400 hover:underline font-medium">
              Contact Us
            </Link>{" "}
            page—we would love to hear from you.
          </p>
        </div>
      </div>
    </div>
  );
}
