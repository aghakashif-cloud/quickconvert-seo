import React from "react";
import type { Metadata } from "next";
import { Layers } from "lucide-react";
import BackButton from "@/components/BackButton";
import QuickToolNav from "@/components/QuickToolNav";
import YouTubeGenerator from "@/components/YouTubeGenerator";
import ToolSeoContent from "@/components/ToolSeoContent";

export const metadata: Metadata = {
  title: "AI YouTube Title, Description & Tag Generator (Free)",
  description:
    "Generate high-CTR YouTube titles, SEO descriptions, chapters, and viral tags in one click. Free Gemini AI studio with no sign-up. Try it now!",
  alternates: { canonical: "/tools/youtube-ai-studio" },
};

export default function YouTubeAiStudioPage() {
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
                <div className="inline-flex items-start sm:items-center gap-2 text-xs font-medium text-rose-400 leading-snug">
                  <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="break-words">
                    Gemini AI Creator Metadata &amp; High-CTR SEO Studio
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight break-words">
                  YouTube AI Studio &amp; Metadata Generator
                </h1>
              </div>

              <QuickToolNav />
            </div>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
          <YouTubeGenerator />

          <ToolSeoContent
            toolName="YouTube AI Studio & Metadata Generator"
            aboutParagraphs={[
              "The YouTube AI Studio & Metadata Generator helps video creators, marketers, and educators craft high-CTR YouTube titles, search-optimized descriptions, suggested chapter outlines, thumbnail text hooks, and targeted keyword tags in seconds using Google Gemini AI.",
              "Instead of guessing which phrasing earns clicks or spending hours researching keywords before every upload, paste your video topic, rough outline, or spoken transcript to receive fresh, uniquely angled YouTube SEO metadata ready to copy straight into YouTube Studio.",
            ]}
            howToSteps={[
              {
                title: "Enter Your Video Topic or Script",
                detail:
                  "Paste a short summary, detailed outline, or full video transcript into the topic box above (or click a sample prompt to try it out).",
              },
              {
                title: "Set Tone, Audience & Format",
                detail:
                  "Choose your preferred tone (High-CTR, Educational, Storytelling), specify your target viewers, and select Long-form Video or YouTube Shorts.",
              },
              {
                title: "Generate & Copy to YouTube Studio",
                detail:
                  "Click Generate Metadata to get a primary title, four alternative hook variations, a full SEO description, thumbnail concept, and 15-20 search tags.",
              },
            ]}
            highlights={[
              "Creates a primary high-CTR title plus four distinct alternative title hooks on every run.",
              "Generates complete YouTube descriptions featuring above-the-fold hooks, key takeaways, calls to action, and relevant hashtags.",
              "Produces 15 to 20 broad and long-tail SEO tags ready to paste into YouTube Studio with one click.",
              "Supports both Long-form videos and YouTube Shorts with fresh, non-repetitive variations every time you regenerate.",
            ]}
          />
        </div>
      </main>
    </div>
  );
}
