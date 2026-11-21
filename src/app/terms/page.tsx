import React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions | QuickConvert & SEO Tools",
  description:
    "Read the Terms and Conditions governing QuickConvert & SEO Tools, including our browser-based file converters and AI YouTube SEO utilities.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-8">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-6">
          <div className="space-y-3 border-b border-slate-800 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <FileText className="w-3.5 h-3.5" />
              Legal Agreement
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Terms and Conditions
            </h1>
            <p className="text-xs text-slate-400">
              Last Updated: November 15, 2026
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using <strong>QuickConvert &amp; SEO Tools</strong>, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these Terms and Conditions, please discontinue use of this website immediately.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                2. Description of Services
              </h2>
              <p>
                QuickConvert &amp; SEO Tools provides browser-based file conversion utilities (powered by client-side WebAssembly, HTML5 Canvas, and PDF/document libraries) and AI-assisted YouTube metadata generation powered by the Google Gemini API. All services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                3. User Responsibilities &amp; Copyright Compliance
              </h2>
              <p>
                You retain full ownership and responsibility for all media files, documents, and text prompts you process using QuickConvert &amp; SEO Tools. By using our tools, you represent and warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-400">
                <li>
                  You own the necessary rights, licenses, or permissions to convert, edit, or process any files you load into the application.
                </li>
                <li>
                  You will not use our tools for any unlawful, infringing, defamatory, or harmful purposes.
                </li>
                <li>
                  You will not attempt to disrupt, overload, or abuse the API endpoints or web infrastructure of QuickConvert &amp; SEO Tools.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                4. Intellectual Property Rights
              </h2>
              <p>
                Unless otherwise stated, QuickConvert &amp; SEO Tools and/or its licensors own the intellectual property rights for the website design, branding, source code, and original text content on QuickConvert &amp; SEO Tools. All intellectual property rights are reserved.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                5. Limitation of Liability
              </h2>
              <p>
                In no event shall QuickConvert &amp; SEO Tools, nor any of its creators, directors, or affiliates, be held liable for anything arising out of or in any way connected with your use of this website, including but not limited to data loss during browser file conversion, inaccuracies in AI-generated metadata, or service interruptions. Always keep backup copies of your original files.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                6. Changes to These Terms
              </h2>
              <p>
                We reserve the right to revise these Terms and Conditions at any time by updating this page. By continuing to use QuickConvert &amp; SEO Tools after any revisions become effective, you agree to be bound by the updated terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">7. Contact Information</h2>
              <p>
                If you have any questions about these Terms and Conditions, please contact us via our{" "}
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
