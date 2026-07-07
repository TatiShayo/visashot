import type { MetadataRoute } from "next";
import { listSpecs } from "@/data/photo-specs";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/photo`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/create`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/vs/pharmacy-passport-photos`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const specRoutes: MetadataRoute.Sitemap = listSpecs().map((s) => ({
    url: `${base}/photo/${s.id}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...specRoutes];
}
