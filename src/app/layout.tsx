import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QuickConvert & SEO Tools - All-in-One File Converter & AI SEO Suite",
  description:
    "Free online tools to convert files, generate YouTube titles, descriptions, and tags using AI. 100% secure and browser-based.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased`}
      >
        <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
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
