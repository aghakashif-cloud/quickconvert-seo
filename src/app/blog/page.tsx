import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Clock, Calendar, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blogData";

export const metadata: Metadata = {
  title: "Blog & Guides — QuickConvert & SEO Tools",
  description:
    "Read step-by-step tutorials, file conversion guides, and YouTube SEO strategies from QuickConvert & SEO Tools.",
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-rose-500/10 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            Tutorials, Guides &amp; Creator SEO Tips
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            QuickConvert &amp; SEO Blog
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Explore practical guides on client-side video, audio, image, and PDF conversion alongside actionable YouTube SEO strategies to grow your channel.
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between transition group shadow-lg shadow-black/20"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition leading-snug">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>

                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  {post.excerpt}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {post.publishedAt}
                </span>

                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-400 group-hover:text-indigo-300 transition"
                >
                  Read Article
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom CTA Banner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">
              Ready to Convert Your Files or Boost Your YouTube SEO?
            </h3>
            <p className="text-xs md:text-sm text-slate-400">
              Try our 100% browser-based File Converter and Gemini AI YouTube Metadata Studio for free.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/?tab=converter"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              Open File Converter
            </Link>
            <Link
              href="/?tab=youtube"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-4 h-4 text-rose-400" />
              YouTube AI Studio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
