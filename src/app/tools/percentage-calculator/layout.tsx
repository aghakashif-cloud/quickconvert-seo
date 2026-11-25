import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Percentage Calculator — Free Online Tool | QuickConvert",
  description:
    "Calculate X% of Y, what percent X is of Y, and percentage increase or decrease instantly in your browser—100% free and accurate.",
  alternates: { canonical: "/tools/percentage-calculator" },
};

export default function PercentageCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
