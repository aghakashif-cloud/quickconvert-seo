import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video-to-SEO Generator & Thumbnail Maker | QuickConvert",
  description:
    "Upload a short video to auto-transcribe audio, generate a YouTube SEO title, description, hashtags, tags, and download a custom 1280x720 HD thumbnail.",
  alternates: { canonical: "/tools/video-to-seo" },
};

export default function VideoToSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
