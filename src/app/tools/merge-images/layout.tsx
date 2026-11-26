import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge Images to JPG or PDF Online [Free & No Upload]",
  description:
    "Stitch JPG, PNG, and WebP photos into one long JPG or multi-page PDF locally in seconds. 100% private, free, and easy to reorder. Try it now!",
  alternates: { canonical: "/tools/merge-images" },
};

export default function MergeImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
