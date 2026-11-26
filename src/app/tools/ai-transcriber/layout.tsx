import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Audio & Video to Text Transcriber (Whisper AI)",
  description:
    "Transcribe MP3, MP4, YouTube & Facebook links into text locally with Whisper AI. 100% private, free, and supports 95+ languages. Start transcribing!",
  alternates: { canonical: "/tools/ai-transcriber" },
};

export default function AudioTranscriberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
