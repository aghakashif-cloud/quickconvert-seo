import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Audiobook Converter (Free TTS) | QuickConvert",
  description:
    "Convert any PDF document, textbook, or ebook into spoken audio locally in your browser using free Text-to-Speech with adjustable voices and speed.",
  alternates: { canonical: "/tools/pdf-to-audiobook" },
};

export default function PdfToAudiobookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
