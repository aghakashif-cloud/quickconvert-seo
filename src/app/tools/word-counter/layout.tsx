import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Word & Character Counter — Free Online | QuickConvert",
  description:
    "Count words, characters with and without spaces, sentences, paragraphs, and reading time in real time directly in your browser—100% private.",
  alternates: { canonical: "/tools/word-counter" },
};

export default function WordCounterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
