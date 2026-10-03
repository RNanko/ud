import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: { root: process.cwd() },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
