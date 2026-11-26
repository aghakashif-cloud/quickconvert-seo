import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Thumbnail Downloader - HD & 4K [Free & Instant]",
  description:
    "Download full HD, 4K, and maxres YouTube thumbnails from any video or Shorts link in one click. 100% free with zero watermarks. Grab yours now!",
  alternates: { canonical: "/tools/thumbnail-downloader" },
};

export default function ThumbnailDownloaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
