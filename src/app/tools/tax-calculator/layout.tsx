import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salary & Property Tax Calculator Free | QuickConvert",
  description:
    "Calculate monthly salary take-home pay, 2024/2025 income tax slabs, and estimated annual property tax for Pakistan, India, US, UK, and UAE free online.",
  alternates: {
    canonical: "/tools/tax-calculator",
  },
  openGraph: {
    title: "Salary & Property Tax Calculator Free | QuickConvert",
    description:
      "Free country-wise Salary Income Tax (Monthly to Annual) and Property Tax estimator for Pakistan, India, US, UK, and UAE.",
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
