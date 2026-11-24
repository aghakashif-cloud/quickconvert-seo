import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge PDF Files Free Online (100% Private) | QuickConvert",
  description:
    "Combine multiple PDF files into one document locally in your browser using pdf-lib. Reorder pages, merge instantly, and keep files 100% private.",
  alternates: { canonical: "/tools/merge-pdf" },
};

export default function MergePdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
