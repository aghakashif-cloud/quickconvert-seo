import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Audiobook Reader - Free PDF Voice TTS (Private)",
  description:
    "Listen to any PDF book, notes, or document aloud with natural browser voices and speed controls. 100% free, local, and zero uploads. Listen now!",
  alternates: { canonical: "/tools/pdf-to-audiobook" },
};

export default function PdfToAudiobookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
