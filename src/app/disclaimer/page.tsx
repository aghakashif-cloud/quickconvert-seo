import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Disclaimer | QuickConvert & SEO Tools",
  description:
    "Read the legal disclaimer for QuickConvert & SEO Tools covering browser-based file conversions, AI-generated YouTube metadata, and links.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-8">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-6">
          <div className="space-y-3 border-b border-slate-800 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Important Notice
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Disclaimer
            </h1>
            <p className="text-xs text-slate-400">
              Last Updated: November 15, 2026
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                1. General Information &amp; Utility Disclaimer
              </h2>
              <p>
                All tools, utilities, and information provided on <strong>QuickConvert &amp; SEO Tools</strong> are published in good faith and for general productivity, educational, and informational purposes only. QuickConvert &amp; SEO Tools makes no warranties about the completeness, reliability, or accuracy of the tools or information provided on this website. Any action you take upon the files or outputs generated on this website is strictly at your own risk.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                2. AI-Generated Content Disclaimer
              </h2>
              <p>
                Our <strong>AI YouTube Metadata Generator</strong> utilizes artificial intelligence (Google Gemini API) to suggest video titles, descriptions, thumbnail concepts, and SEO tags. AI-generated suggestions are automated and may occasionally produce inaccurate, incomplete, or unverified statements. Users should review and edit all generated titles, descriptions, and tags before publishing them to YouTube or any other platform. We do not guarantee any specific search ranking, viewership, or monetization outcome.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                3. Client-Side File Conversion Disclaimer
              </h2>
              <p>
                Because file conversions occur locally inside your web browser using your device&apos;s hardware resources, conversion speed and output quality depend on your browser compatibility, available system memory (RAM), and source file integrity. Always maintain a backup copy of your original files before performing format conversions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                4. External Links &amp; Third-Party Advertisements
              </h2>
              <p>
                From our website, you may visit external websites by following hyperlinks or interacting with third-party advertisements served via Google AdSense. While we strive to provide only quality links to useful and ethical websites, we have no control over the content and nature of these external sites. The inclusion of any links or advertisements does not imply a recommendation or endorsement for the views expressed within them.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">5. Consent</h2>
              <p>
                By using our website, you hereby consent to our Disclaimer and agree to its terms. If you require any more information or have any questions about our site&apos;s disclaimer, please feel free to contact us via our{" "}
                <Link href="/contact" className="text-indigo-400 hover:underline">
                  Contact Us
                </Link>{" "}
                page or email us at{" "}
                <a
                  href="mailto:support@quickconvertseo.com"
                  className="text-indigo-400 hover:underline"
                >
                  support@quickconvertseo.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
