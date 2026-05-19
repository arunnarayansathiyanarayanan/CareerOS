import type { MetadataRoute } from "next";

import { PRODUCT_ORIGIN } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/", "/p/", "/sign-in", "/sign-up"],
        disallow: [
          "/api/",
          "/dashboard",
          "/onboarding",
          "/interview",
          "/resume",
          "/skills",
          "/projects",
          "/community",
          "/app",
        ],
      },
    ],
    sitemap: `${PRODUCT_ORIGIN}/sitemap.xml`,
  };
}
