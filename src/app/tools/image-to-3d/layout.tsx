import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image to 3D Parallax Generator Free | QuickConvert",
  description:
    "Turn any 2D photo into an interactive 3D parallax model free in your browser using Depth Anything AI & Three.js. Rotate, zoom, and export snapshots.",
  alternates: {
    canonical: "/tools/image-to-3d",
  },
  openGraph: {
    title: "Image to 3D Parallax Generator Free | QuickConvert",
    description:
      "Generate AI depth maps client-side with Depth Anything and explore your photos in interactive 3D with Three.js OrbitControls. 100% private and free.",
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
