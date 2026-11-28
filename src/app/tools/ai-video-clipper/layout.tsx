import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart AI Jump-Cut Editor - Remove Silences Free",
  description:
    "Auto-edit talking-head videos free in your browser. Remove silences, awkward pauses, and filler words (um, uh) with Whisper AI & FFmpeg WASM.",
  alternates: { canonical: "/tools/ai-video-clipper" },
};

export default function AiVideoClipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
