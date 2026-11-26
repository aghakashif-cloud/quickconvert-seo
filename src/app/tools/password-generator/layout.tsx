import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strong Password Generator - Random & Secure (No Log)",
  description:
    "Create uncrackable random passwords locally with crypto.getRandomValues. Customize length & symbols with one-click copy and zero tracking. Generate now!",
  alternates: {
    canonical: "/tools/password-generator",
  },
  openGraph: {
    title: "Strong Password Generator - Random & Secure (No Log)",
    description:
      "Create uncrackable random passwords locally with crypto.getRandomValues. Customize length & symbols with one-click copy and zero tracking. Generate now!",
    url: "https://www.quickconvertseo.com/tools/password-generator",
    type: "website",
  },
};

export default function PasswordGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
