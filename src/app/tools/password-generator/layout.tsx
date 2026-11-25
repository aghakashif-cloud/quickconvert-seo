import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strong Random Password Generator Free | QuickConvert",
  description:
    "Generate strong, random passwords locally with crypto.getRandomValues. Customize length, uppercase, lowercase, numbers & symbols with one-click copy.",
  alternates: {
    canonical: "/tools/password-generator",
  },
  openGraph: {
    title: "Strong Random Password Generator Free | QuickConvert",
    description:
      "Create cryptographically secure random passwords directly in your browser using crypto.getRandomValues. 100% private and free.",
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
