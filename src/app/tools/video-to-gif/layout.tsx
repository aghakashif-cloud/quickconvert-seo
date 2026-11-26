import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video to GIF Converter - MP4 & WebM to GIF (No Upload)",
  description:
    "Convert MP4, MOV, and WebM clips into smooth animated GIFs right in your browser. 100% free, private, and watermark-free. Create your GIF now!",
  alternates: { canonical: "/tools/video-to-gif" },
};

export default function VideoToGifLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
