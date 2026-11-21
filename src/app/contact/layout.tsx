import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | QuickConvert & SEO Tools",
  description:
    "Contact QuickConvert & SEO Tools for support, feedback, or business inquiries about our browser-based file converters and YouTube AI tools.",
  alternates: { canonical: "/contact" },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
