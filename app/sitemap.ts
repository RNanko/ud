import type { MetadataRoute } from "next";
import { publicOrigin, indexPublicSite } from "@/lib/brand";
export default function sitemap(): MetadataRoute.Sitemap { return indexPublicSite() ? [{ url: publicOrigin(), changeFrequency: "monthly", priority: 1 }, { url: `${publicOrigin()}/help`, changeFrequency: "monthly", priority: 0.6 }] : []; }
