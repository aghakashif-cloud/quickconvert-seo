import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Clipper & Viral Shorts Finder | QuickConvert",
  description:
    "Upload a video to extract audio locally with FFmpeg WASM and let Gemini AI pinpoint the most engaging 30-60 second Shorts and Reels clips.",
  alternates: { canonical: "/tools/ai-video-clipper" },
};

export default function AiVideoClipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
