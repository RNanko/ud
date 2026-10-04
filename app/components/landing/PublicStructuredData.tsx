import { publicGraph, serializeJsonLd, type PublicBreadcrumb } from "@/lib/seo/structured-data";
import type { PublicPath } from "@/lib/seo/public-pages";

export default function PublicStructuredData({ path, title, description, breadcrumbs = [] }: { path: PublicPath; title: string; description: string; breadcrumbs?: PublicBreadcrumb[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(publicGraph(path, title, description, breadcrumbs)) }} />;
}
