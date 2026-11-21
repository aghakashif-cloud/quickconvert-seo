import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Thumbnail Downloader (HD & 4K) | QuickConvert",
  description:
    "Download HD, Full HD, and 4K YouTube thumbnails from any video or Shorts URL instantly in maxres, SD, HQ, and MQ resolutions for free.",
  alternates: { canonical: "/tools/thumbnail-downloader" },
};

export default function ThumbnailDownloaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
