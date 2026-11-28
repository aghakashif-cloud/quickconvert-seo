import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Background Remover - Transparent PNG (No Upload)",
  description:
    "Remove image backgrounds free 100% locally in your browser. Replace with solid colors, gradients, or custom photos & export HD PNG or JPG.",
  alternates: { canonical: "/tools/background-remover" },
};

export default function BackgroundRemoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
