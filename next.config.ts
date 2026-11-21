import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@distube/ytdl-core", "jsdom", "bgutils-js"],
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "tab", value: "converter" }],
        destination: "/tools/file-converter",
        statusCode: 301,
      },
      {
        source: "/",
        has: [{ type: "query", key: "tab", value: "youtube" }],
        destination: "/tools/youtube-ai-studio",
        statusCode: 301,
      },
      {
        source: "/tools/youtube-audit",
        destination: "/tools/youtube-seo-audit",
        statusCode: 301,
      },
      {
        source: "/tools/audio-transcriber",
        destination: "/tools/ai-transcriber",
        statusCode: 301,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      canvas: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
