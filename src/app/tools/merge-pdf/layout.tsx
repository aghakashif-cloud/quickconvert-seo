import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge PDF Files Online - Combine PDFs Free (No Upload)",
  description:
    "Combine and reorder multiple PDF files into one document instantly in your browser. 100% private, free, and zero watermarks. Merge your PDFs now!",
  alternates: { canonical: "/tools/merge-pdf" },
};

export default function MergePdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
