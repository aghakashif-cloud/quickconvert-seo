import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video to Animated GIF Converter | QuickConvert",
  description:
    "Convert MP4, MOV, and WebM video clips into lightweight animated GIFs 100% locally in your browser using FFmpeg WebAssembly—free and private.",
  alternates: { canonical: "/tools/video-to-gif" },
};

export default function VideoToGifLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
