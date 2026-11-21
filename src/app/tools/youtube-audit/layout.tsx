import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube SEO Audit & Video Analyzer | QuickConvert",
  description:
    "Paste any YouTube video URL to audit its title, description, and tags with an instant 0-100 AI SEO scorecard and optimized metadata fixes.",
  alternates: { canonical: "/tools/youtube-audit" },
};

export default function YouTubeAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
