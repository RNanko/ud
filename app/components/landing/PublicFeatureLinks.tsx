import Link from "next/link";
import { publicFeaturePages, type PublicPath } from "@/lib/seo/public-pages";

export default function PublicFeatureLinks({ current }: { current?: PublicPath }) {
  return <nav className="mf-public-links" aria-label="Explore ManForth features">
    {publicFeaturePages.filter(page => page.path !== current).map(page => <Link key={page.path} prefetch={false} href={page.path}>{page.label}<span aria-hidden="true">↗</span></Link>)}
  </nav>;
}
