import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge Images to JPG or PDF Free Online | QuickConvert",
  description:
    "Combine multiple JPG, PNG, and WebP images into one long JPG image or a multi-page PDF document locally in your browser—100% free and private.",
  alternates: { canonical: "/tools/merge-images" },
};

export default function MergeImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
