import type { MetadataRoute } from "next";

import { PRODUCT_ORIGIN } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: PRODUCT_ORIGIN,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${PRODUCT_ORIGIN}/sign-in`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${PRODUCT_ORIGIN}/sign-up`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
