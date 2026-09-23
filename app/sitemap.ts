import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/posts";

const SITE = "https://adithmohanty.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, priority: 1 },
    { url: `${SITE}/blog`, priority: 0.6 },
    { url: `${SITE}/gallery`, priority: 0.5 },
    ...getPosts().map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.date || undefined,
      priority: 0.5,
    })),
  ];
}
