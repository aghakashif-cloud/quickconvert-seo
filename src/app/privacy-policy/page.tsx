import React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — QuickConvert & SEO Tools",
  description:
    "Read the QuickConvert & SEO Tools Privacy Policy covering client-side file processing, data collection, cookies, COPPA, and Google AdSense third-party advertising.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 space-y-8">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-6">
          {/* Page Header */}
          <div className="space-y-3 border-b border-slate-800 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Privacy &amp; Data Protection
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-400">
              Last Updated: November 16, 2024
            </p>
          </div>

          {/* Policy Sections */}
          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">1. Introduction</h2>
              <p>
                At <strong>QuickConvert &amp; SEO Tools</strong>, accessible from our website, protecting the privacy of our visitors is one of our highest priorities. This Privacy Policy document outlines the types of information that are collected and recorded by QuickConvert &amp; SEO Tools and how we use and safeguard that information.
              </p>
            </section>

            <section className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 space-y-2">
              <h2 className="text-lg font-bold text-emerald-400">
                2. Data Security &amp; File Processing
              </h2>
              <p className="text-slate-200">
                We prioritize your privacy. Our file conversion tools are built using client-side technologies (like WebAssembly and Canvas). This means your files are processed entirely within your web browser. We do not upload, transfer, or store your files on our servers at any point.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                3. 100% Client-Side File Conversion &amp; Local Processing Details
              </h2>
              <p>
                Our Universal File Converter (including video, audio, image, PDF, and document conversion) operates 100% client-side inside your web browser using WebAssembly (<code>@ffmpeg/ffmpeg</code>), the HTML5 Canvas API, <code>pdf-lib</code>, and <code>mammoth.js</code>.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-400">
                <li>
                  Your files are never uploaded to, stored on, or transmitted through our servers.
                </li>
                <li>
                  All file transcoding and document rendering happen strictly in your local device memory.
                </li>
                <li>
                  When you close your browser tab or clear the conversion queue, temporary browser blob URLs are immediately revoked from memory.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                4. Information Collection and AI Features
              </h2>
              <p>
                When you use the <strong>AI YouTube Metadata Generator</strong>, the topic, keywords, or transcript text you enter is sent securely to the Google Gemini API solely for the purpose of generating your requested titles, descriptions, and SEO tags. We do not permanently store or sell your submitted prompts. If you contact us via our Contact page, we collect only the name, email address, and message content you voluntarily provide so we can respond to your inquiry.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                5. Cookies and Web Beacons
              </h2>
              <p>
                Like most modern websites, QuickConvert &amp; SEO Tools uses standard cookies and local storage to store user preferences, optimize site performance, and analyze aggregate traffic trends. You can choose to disable cookies through your individual browser options at any time.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                6. Google AdSense &amp; Third-Party Advertising Partners
              </h2>
              <p>
                We may use <strong>Google AdSense</strong> and other third-party advertising companies to serve advertisements when you visit our website. Please note the following disclosures required by Google AdSense policy:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-400">
                <li>
                  Third-party vendors, including Google, use cookies (such as the Google DoubleClick DART cookie) to serve ads based on a user&apos;s prior visits to our website or other websites on the internet.
                </li>
                <li>
                  Google&apos;s use of advertising cookies enables it and its partners to serve ads to our users based on their visit to QuickConvert &amp; SEO Tools and/or other sites on the Internet.
                </li>
                <li>
                  Users may opt out of personalized advertising by visiting{" "}
                  <a
                    href="https://www.google.com/settings/ads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    Google Ads Settings
                  </a>{" "}
                  or by visiting{" "}
                  <a
                    href="https://www.aboutads.info/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    www.aboutads.info
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">7. Log Files</h2>
              <p>
                QuickConvert &amp; SEO Tools follows a standard procedure of using server log files. These files log visitors when they visit websites. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                8. CCPA &amp; GDPR Privacy Rights
              </h2>
              <p>
                Depending on your location, you have the right to request access to, correction of, or deletion of any personal data we may hold, as well as the right to restrict or object to data processing. Because our file conversion tools do not upload or retain user files on any server, we do not store copies of your personal media.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                9. Children&apos;s Information (COPPA)
              </h2>
              <p>
                Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity. QuickConvert &amp; SEO Tools does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">10. Consent</h2>
              <p>
                By using our website, you hereby consent to our Privacy Policy and agree to its{" "}
                <Link href="/terms" className="text-indigo-400 hover:underline">
                  Terms and Conditions
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">11. Contact Us</h2>
              <p>
                If you have any questions or require more information about our Privacy Policy, please do not hesitate to contact us at{" "}
                <a
                  href="mailto:support@quickconvert.tools"
                  className="text-indigo-400 hover:underline"
                >
                  support@quickconvert.tools
                </a>{" "}
                or via our{" "}
                <Link href="/contact" className="text-indigo-400 hover:underline">
                  Contact Us
                </Link>{" "}
                page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
