import type { NextConfig } from "next";
import { indexPublicSite } from "./lib/brand";
import { excludedSearchSurfaces } from "./lib/seo/public-pages";

const nextConfig: NextConfig = {
  // Separate local QA output/lock from an already running ordinary web server.
  ...(process.env.NODE_ENV === "development" && process.env.MANFORTH_MOBILE_API_ENABLED === "true" ? { distDir: ".next-mobile-qa" } : {}),
  cacheComponents: true,
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: {
    // Pages also import the social image module to resolve its metadata.
    "/*": ["./public/manforth/finance-1100.webp"],
  },
  async headers() {
    const sources = indexPublicSite() ? excludedSearchSurfaces : ["/:path*"];
    return sources.map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }));
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
