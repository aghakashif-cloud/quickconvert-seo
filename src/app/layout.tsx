import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

const siteTitle = "QuickConvert & SEO Tools — Free Converter & AI Suite";
const siteDescription =
  "Convert video, audio, images, and PDFs 100% locally in your browser, plus generate high-CTR YouTube SEO titles, descriptions, and tags free.";
const siteUrl = "https://quickconvertseo.com";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "QuickConvert & SEO Tools",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QuickConvert",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "QuickConvert & SEO Tools — Free Converter & AI Suite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/icons/icon-512x512.png"],
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
          <ServiceWorkerRegister />
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
