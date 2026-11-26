import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image to 3D Parallax Generator - AI Depth Map (Free)",
  description:
    "Turn any 2D photo into an interactive 3D model locally with Depth Anything AI & Three.js. Free, private, with PNG & 3D video export. Try it now!",
  alternates: {
    canonical: "/tools/image-to-3d",
  },
  openGraph: {
    title: "Image to 3D Parallax Generator - AI Depth Map (Free)",
    description:
      "Turn any 2D photo into an interactive 3D model locally with Depth Anything AI & Three.js. Free, private, with PNG & 3D video export. Try it now!",
    url: "https://www.quickconvertseo.com/tools/image-to-3d",
    type: "website",
  },
};

export default function ImageTo3DLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
