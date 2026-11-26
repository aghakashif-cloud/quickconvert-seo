import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Income & Property Tax Calculator 2024/2025 [Free]",
  description:
    "Calculate monthly take-home salary, 2024/2025 income tax slabs, and annual property tax for PK, IN, US, UK & UAE. 100% private. Estimate yours now!",
  alternates: {
    canonical: "/tools/tax-calculator",
  },
  openGraph: {
    title: "Income & Property Tax Calculator 2024/2025 [Free]",
    description:
      "Calculate monthly take-home salary, 2024/2025 income tax slabs, and annual property tax for PK, IN, US, UK & UAE. 100% private. Estimate yours now!",
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
