import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Tag,
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

function clampMetaText(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const sliced = cleaned.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxChars * 0.6) ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[,:;|\-—–\s]+$/, "")}…`;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | QuickConvert & SEO Tools",
    };
  }

  const rawTitle = post.metaTitle || post.title;
  const metaTitle = clampMetaText(rawTitle, 58);
  const metaDescription = clampMetaText(
    post.metaDescription || post.excerpt,
    155
  );

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: post.focusKeywords,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
    },
  };
}

/**
 * Renders inline markdown-style internal links like `[Free File Converter](/?tab=converter)`
 * as styled Next.js `<Link>` elements while preserving all surrounding text.
 */
function renderRichText(text: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const label = match[1];
    const href = match[2];
    const isInternal = href.startsWith("/");

    if (isInternal) {
      parts.push(
        <Link
          key={`${match.index}-${href}`}
          href={href}
          className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 font-semibold transition"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={`${match.index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 font-semibold transition"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
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

        {/* Article Header (H1) */}
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

          {/* Focus Keywords Pills */}
          {post.focusKeywords && post.focusKeywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-400" />
                Topics:
              </span>
              {post.focusKeywords.map((kw, kIdx) => (
                <span
                  key={kIdx}
                  className="text-[11px] px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-400">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <span>
              Written by <strong className="text-slate-200">{post.author}</strong>
            </span>
          </div>
        </header>

        {/* Featured Visual Diagram / Illustration */}
        {post.coverImage && (
          <figure className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden p-3 sm:p-4 space-y-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImage.src}
              alt={post.coverImage.alt}
              width={800}
              height={340}
              className="w-full h-auto rounded-xl border border-slate-800/80"
            />
            <figcaption className="text-xs text-slate-400 text-center px-2">
              {post.coverImage.caption}
            </figcaption>
          </figure>
        )}

        {/* Article Body (H2 & H3 Semantic Structure) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-10 leading-relaxed">
          {post.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight border-b border-slate-800/80 pb-2.5">
                {section.heading}
              </h2>

              {section.image && (
                <figure className="my-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl overflow-hidden p-3 space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={section.image.src}
                    alt={section.image.alt}
                    width={800}
                    height={280}
                    loading="lazy"
                    className="w-full h-auto rounded-xl border border-slate-800/70"
                  />
                  <figcaption className="text-xs text-slate-400 text-center px-2">
                    {section.image.caption}
                  </figcaption>
                </figure>
              )}

              {section.paragraphs.map((paragraph, pIdx) => (
                <p
                  key={pIdx}
                  className="text-sm md:text-base text-slate-300 leading-7"
                >
                  {renderRichText(paragraph)}
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
                      <span>{renderRichText(bullet)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.numberedList && section.numberedList.length > 0 && (
                <ol className="space-y-2.5 pt-2">
                  {section.numberedList.map((item, nIdx) => (
                    <li
                      key={nIdx}
                      className="flex items-start gap-3 text-sm md:text-base text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5"
                    >
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {nIdx + 1}
                      </span>
                      <span>{renderRichText(item)}</span>
                    </li>
                  ))}
                </ol>
              )}

              {/* H3 Subsections */}
              {section.subSections && section.subSections.length > 0 && (
                <div className="space-y-6 pt-3 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-indigo-500/30">
                  {section.subSections.map((sub, sIdx) => (
                    <div key={sIdx} className="space-y-2.5">
                      <h3 className="text-base md:text-lg font-bold text-indigo-300">
                        {sub.subheading}
                      </h3>
                      {sub.paragraphs.map((sp, spIdx) => (
                        <p
                          key={spIdx}
                          className="text-sm md:text-base text-slate-300 leading-7"
                        >
                          {renderRichText(sp)}
                        </p>
                      ))}
                      {sub.bullets && sub.bullets.length > 0 && (
                        <ul className="space-y-2 pt-1">
                          {sub.bullets.map((sb, sbIdx) => (
                            <li
                              key={sbIdx}
                              className="flex items-start gap-2.5 text-sm text-slate-300 bg-slate-950/60 border border-slate-800/70 rounded-xl p-3"
                            >
                              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                              <span>{renderRichText(sb)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {sub.numberedList && sub.numberedList.length > 0 && (
                        <ol className="space-y-2 pt-1">
                          {sub.numberedList.map((sn, snIdx) => (
                            <li
                              key={snIdx}
                              className="flex items-start gap-2.5 text-sm text-slate-300 bg-slate-950/60 border border-slate-800/70 rounded-xl p-3"
                            >
                              <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {snIdx + 1}
                              </span>
                              <span>{renderRichText(sn)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Contextual Internal Tool Link */}
              {section.ctaLink && (
                <div className="pt-3">
                  <Link
                    href={section.ctaLink.href}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs md:text-sm font-semibold transition shadow-sm"
                  >
                    <span>{section.ctaLink.text}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </section>
          ))}

          {/* Dedicated FAQ Section (H2 + H3 questions) */}
          {post.faqs && post.faqs.length > 0 && (
            <section className="pt-6 border-t border-slate-800 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  Frequently Asked Questions (FAQ)
                </h2>
              </div>

              <div className="space-y-4">
                {post.faqs.map((faq, fIdx) => (
                  <div
                    key={fIdx}
                    className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 space-y-2"
                  >
                    <h3 className="text-base font-bold text-slate-100">
                      {faq.question}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {renderRichText(faq.answer)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Embedded Bottom Tool Callout */}
          <div className="mt-8 bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-500/30 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                100% Free &amp; Client-Side
              </div>
              <h3 className="text-lg font-bold text-white">
                Ready to Put This Guide Into Action?
              </h3>
              <p className="text-xs md:text-sm text-slate-300">
                Convert files locally or generate high-ranking YouTube metadata in seconds.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/tools/file-converter"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
              >
                Try our Free File Converter
              </Link>
              <Link
                href="/tools/youtube-ai-studio"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                YouTube AI Studio
              </Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
