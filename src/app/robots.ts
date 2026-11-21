import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*?tab=*", "/*?mode=*", "/*&tab=*", "/*&mode=*"],
    },
    sitemap: "https://www.quickconvertseo.com/sitemap.xml",
  };
}
