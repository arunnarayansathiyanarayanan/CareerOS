import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 pulls in pdfjs-dist ESM; bundling it breaks the resume API route.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com", pathname: "/**" },
      { protocol: "https", hostname: "images.clerk.dev", pathname: "/**" },
    ],
  },
};

export default nextConfig;
