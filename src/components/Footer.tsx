import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Brand, Product Hunt Badge & Copyright */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-4 text-center sm:text-left">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition">
              QuickConvert <span className="text-indigo-400">&amp; SEO Tools</span>
            </span>
          </Link>

          {/* Product Hunt Featured Social Proof Badge */}
          <a
            href="https://www.producthunt.com/products/quickconvert-seo-tools?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-quickconvert-seo-tools"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center transition-transform hover:scale-[1.02]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="QuickConvert & SEO Tools - Free Online File Converter & AI YouTube Metadata Generator | Product Hunt"
              width={250}
              height={54}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1321214&theme=light&t=1795065974584"
              className="h-10 w-auto"
            />
          </a>

          {/* LaunchBuff Featured Badge */}
          <a
            href="https://launchbuff.com/products/quickconvert-seo-tools-a0061l"
            target="_blank"
            rel="noopener noreferrer"
            title="Featured on LaunchBuff"
            className="inline-flex items-center transition-transform hover:scale-[1.02]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://launchbuff.com/badge-featured-dark.svg"
              alt="Featured on LaunchBuff"
              width={256}
              height={80}
              className="h-10 w-auto"
            />
          </a>

          <span className="hidden sm:inline text-slate-700">•</span>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} QuickConvert &amp; SEO Tools. All rights reserved.
          </p>
        </div>

        {/* Essential Legal & AdSense Navigation Links */}
        <nav
          aria-label="Footer Legal Navigation"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium"
        >
          <Link
            href="/"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Home
          </Link>
          <Link
            href="/blog"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Blog
          </Link>
          <Link
            href="/about"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Contact
          </Link>
          <Link
            href="/privacy-policy"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Terms
          </Link>
          <Link
            href="/disclaimer"
            className="text-slate-400 hover:text-indigo-400 transition"
          >
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
