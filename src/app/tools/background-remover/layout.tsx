import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Background Remover & Photo Editor (No Upload)",
  description:
    "Remove photo backgrounds locally with AI, drag and resize subjects on an interactive canvas, add logos or new backgrounds, and export PNG/JPG.",
  alternates: { canonical: "/tools/background-remover" },
};

export default function BackgroundRemoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
