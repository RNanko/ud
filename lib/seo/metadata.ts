import type { Metadata } from "next";
import { brand, indexPublicSite, publicOrigin } from "../brand";
import type { PublicPath } from "./public-pages";

export const socialImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "ManForth by B1-Way — Plan your week. Record your work. Review your progress." };

export function publicMetadata(path: PublicPath, title: string, description: string): Metadata {
  const url = publicOrigin() + path;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url },
    robots: { index: indexPublicSite(), follow: indexPublicSite() },
    openGraph: { title, description, url, siteName: brand.productName, locale: "en_US", type: "website", images: [socialImage] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: socialImage.url, alt: socialImage.alt }] },
  };
}
