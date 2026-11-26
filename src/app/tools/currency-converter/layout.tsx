import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Currency Converter - Live Exchange Rates (160+)",
  description:
    "Convert USD, EUR, GBP, PKR, INR, AED & 160+ currencies instantly using live exchange rates. Free, accurate, with timestamps. Convert now!",
  alternates: {
    canonical: "/tools/currency-converter",
  },
  openGraph: {
    title: "Free Currency Converter - Live Exchange Rates (160+)",
    description:
      "Convert USD, EUR, GBP, PKR, INR, AED & 160+ currencies instantly using live exchange rates. Free, accurate, with timestamps. Convert now!",
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
