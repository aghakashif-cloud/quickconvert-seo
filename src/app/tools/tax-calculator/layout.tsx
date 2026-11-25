import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Country-Wise Income Tax Calculator | QuickConvert",
  description:
    "Estimate annual income tax, effective tax rate, net take-home pay, and slab-by-slab breakdown for Pakistan, India, US, UK, and UAE free in your browser.",
  alternates: {
    canonical: "/tools/tax-calculator",
  },
  openGraph: {
    title: "Country-Wise Income Tax Calculator | QuickConvert",
    description:
      "Calculate estimated annual income tax, effective tax rate, net income, and progressive slab breakdown for Pakistan, India, US, UK, and UAE.",
    url: "https://www.quickconvertseo.com/tools/tax-calculator",
    type: "website",
  },
};

export default function TaxCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
