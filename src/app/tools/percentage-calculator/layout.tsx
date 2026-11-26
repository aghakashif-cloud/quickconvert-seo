import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Percentage Calculator - Discounts, Tax & Growth (Free)",
  description:
    "Calculate X% of Y, percent of total, and percentage increase or decrease instantly. Free, accurate, and 100% private in your browser. Calculate now!",
  alternates: { canonical: "/tools/percentage-calculator" },
};

export default function PercentageCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
