import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Tilt Video Player - Watch & Record 3D Clips (Free)",
  description:
    "Play MP4 & WebM videos in an interactive 3D parallax player with mouse hover, mobile gyroscope & WebM clip recording. 100% private. Try it now!",
  alternates: {
    canonical: "/tools/3d-video-player",
  },
  openGraph: {
    title: "3D Tilt Video Player - Watch & Record 3D Clips (Free)",
    description:
      "Play MP4 & WebM videos in an interactive 3D parallax player with mouse hover, mobile gyroscope & WebM clip recording. 100% private. Try it now!",
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
