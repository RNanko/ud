import type { NextConfig } from "next";
import { indexPublicSite } from "./lib/brand";
import { excludedSearchSurfaces } from "./lib/seo/public-pages";

const development = process.env.NODE_ENV === "development";
// Cache Components prerenders shell scripts, so per-request nonces cannot be
// used here. Allow Next/theme bootstrap scripts and chart/motion styles while
// restricting origins, inline event handlers, embedding and document rewrites.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${development ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  ...(!development ? ["upgrade-insecure-requests"] : []),
].join("; ");

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
    return [
      { source: "/:path*", headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ] },
      ...sources.map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
