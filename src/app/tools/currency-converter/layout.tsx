import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Live Currency Converter Online | QuickConvert",
  description:
    "Convert 160+ world currencies instantly with live exchange rates. Free client-side USD, EUR, GBP, PKR, INR & AED converter with last-updated dates.",
  alternates: {
    canonical: "/tools/currency-converter",
  },
  openGraph: {
    title: "Free Live Currency Converter Online | QuickConvert",
    description:
      "Convert world currencies in real time with live exchange rates for USD, EUR, GBP, PKR, INR, AED, and 160+ more currencies.",
    url: "https://www.quickconvertseo.com/tools/currency-converter",
    type: "website",
  },
};

export default function CurrencyConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
