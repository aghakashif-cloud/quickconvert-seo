import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Tilt Video Player Online Free | QuickConvert",
  description:
    "Watch MP4 & WebM videos in an interactive 3D parallax tilt player with mouse hover & mobile gyroscope motion. 100% private, client-side & free.",
  alternates: {
    canonical: "/tools/3d-video-player",
  },
  openGraph: {
    title: "3D Tilt Video Player Online Free | QuickConvert",
    description:
      "Play local MP4 and WebM videos inside an interactive 3D parallax tilt cinema with glowing ambient depth and mobile gyroscope support.",
    url: "https://www.quickconvertseo.com/tools/3d-video-player",
    type: "website",
  },
};

export default function ThreeDVideoPlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
