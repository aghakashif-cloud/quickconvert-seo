import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Word & Character Counter - Real-Time Tool [Free]",
  description:
    "Count words, characters with and without spaces, sentences, paragraphs & reading time live as you type. 100% free and private. Paste your text now!",
  alternates: { canonical: "/tools/word-counter" },
};

export default function WordCounterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
