import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/brand";
import { privateCrawlPrefixes } from "@/lib/seo/public-pages";
export default function robots(): MetadataRoute.Robots {
  // Public auth/legal noindex must be discoverable; previews also send site-wide noindex headers.
  return { rules: { userAgent: "*", allow: "/", disallow: privateCrawlPrefixes }, sitemap: `${publicOrigin()}/sitemap.xml` };
}
