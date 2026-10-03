import type { MetadataRoute } from "next";
import { indexPublicSite, publicOrigin } from "@/lib/brand";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", ...(indexPublicSite() ? { allow: "/", disallow: ["/account", "/auth", "/api", "/portfolio"] } : { disallow: "/" }) }, sitemap: `${publicOrigin()}/sitemap.xml` };
}
