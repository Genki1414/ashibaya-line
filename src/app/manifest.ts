import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "足場信用プラットフォーム",
    short_name: "足場信用",
    description: "足場工事の元請・協力会社をつなぐ信用プラットフォーム",
    start_url: "/home",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#1657C9",
    lang: "ja",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
