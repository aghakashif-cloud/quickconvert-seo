import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video to YouTube SEO & Thumbnail Generator [Free AI]",
  description:
    "Upload a video to auto-transcribe speech and generate SEO titles, tags, and a 1280x720 HD thumbnail in one click. Free & fast. Try it now!",
  alternates: { canonical: "/tools/video-to-seo" },
};

export default function VideoToSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
