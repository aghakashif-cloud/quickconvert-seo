import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Tag Extractor & SEO Audit Tool [Free & Instant]",
  description:
    "See hidden YouTube tags and audit any video URL for a 0-100 SEO score in seconds. 100% free with instant AI title & tag fixes. Paste a URL now!",
  alternates: { canonical: "/tools/youtube-seo-audit" },
};

export default function YouTubeAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
