import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Clipper - Find Viral Shorts & Reels (Free)",
  description:
    "Automatically find the best 30-60s viral Shorts and Reels clips from long videos. Local audio extraction with free AI timestamps. Try it today!",
  alternates: { canonical: "/tools/ai-video-clipper" },
};

export default function AiVideoClipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
