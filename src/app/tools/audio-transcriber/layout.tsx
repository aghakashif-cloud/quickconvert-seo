import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Audio & Video Transcriber | QuickConvert",
  description:
    "Transcribe audio, video, YouTube, and Facebook links into text locally in your browser using Whisper AI. Supports English, Urdu, and 95+ languages.",
  alternates: { canonical: "/tools/audio-transcriber" },
};

export default function AudioTranscriberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
