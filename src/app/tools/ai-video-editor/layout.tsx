import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Editor - Merge Clips & Remove Silences for Free",
  description:
    "Upload multiple clips, merge them, and automatically remove awkward pauses and filler words using AI. 100% client-side and private.",
  alternates: { canonical: "/tools/ai-video-editor" },
};

export default function AiVideoEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
