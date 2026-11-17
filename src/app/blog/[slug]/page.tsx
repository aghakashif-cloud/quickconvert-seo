import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { BLOG_POSTS, getBlogPostBySlug } from "@/lib/blogData";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found — QuickConvert & SEO Tools",
    };
  }

  return {
    title: `${post.title} — QuickConvert & SEO Tools`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-6">
      <article className="max-w-3xl mx-auto space-y-8">
        {/* Back to Blog Link */}
        <div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Articles
          </Link>
        </div>

        {/* Article Header */}
        <header className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {post.readTime}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {post.publishedAt}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            {post.excerpt}
          </p>

          <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-400">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <span>
              Written by <strong className="text-slate-200">{post.author}</strong>
            </span>
          </div>
        </header>

        {/* Article Body (Clean Reading Layout) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-8 leading-relaxed">
          {post.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {section.heading}
              </h2>

              {section.paragraphs.map((paragraph, pIdx) => (
                <p
                  key={pIdx}
                  className="text-sm md:text-base text-slate-300 leading-7"
                >
                  {paragraph}
                </p>
              ))}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="space-y-2.5 pt-2">
                  {section.bullets.map((bullet, bIdx) => (
                    <li
                      key={bIdx}
                      className="flex items-start gap-3 text-sm md:text-base text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* Embedded Tool Callout inside the Article */}
          <div className="mt-8 bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-500/30 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                100% Free &amp; Client-Side
              </div>
              <h3 className="text-lg font-bold text-white">
                Try It Now: Convert Your Files Locally in Seconds
              </h3>
              <p className="text-xs md:text-sm text-slate-300">
                No sign-up, no watermarks, and zero server uploads.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/?tab=converter&mode=audio"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
              >
                Convert MP4 to MP3 Now
              </Link>
              <Link
                href="/?tab=youtube"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                YouTube AI Tool
              </Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
