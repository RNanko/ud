import type { MetadataRoute } from "next";
import { publicOrigin, indexPublicSite } from "@/lib/brand";
import { publicPages } from "@/lib/seo/public-pages";
export default function sitemap(): MetadataRoute.Sitemap {
  return indexPublicSite() ? publicPages.map(page => ({ url: publicOrigin() + page.path })) : [];
}
