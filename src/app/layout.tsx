import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

const siteTitle =
  "QuickConvert & SEO Tools - Free Online File Converter & AI YouTube Metadata Generator";
const siteDescription =
  "Convert videos, audio, images, PDFs, and documents for free online. 100% secure client-side conversion. Also generate high-ranking YouTube titles, descriptions, and tags using AI.";
const siteUrl = "https://quickconvertseo.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "free online file converter",
    "video converter",
    "audio converter",
    "image converter",
    "PDF converter",
    "DOCX to PDF",
    "MP4 to MP3",
    "client-side file converter",
    "YouTube metadata generator",
    "AI YouTube title generator",
    "YouTube SEO tags generator",
    "QuickConvert & SEO Tools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "QuickConvert & SEO Tools",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuickConvert & SEO Tools - Free Online File Converter & AI YouTube Metadata Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtm.js?id=GTM-KN697JGF"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
`,
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4888055672968030"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased`}
      >
        <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col overflow-x-clip">
          <Navbar />
          <div className="flex-1 flex flex-col bg-slate-950 text-slate-100">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
