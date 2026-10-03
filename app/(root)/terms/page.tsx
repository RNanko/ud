import { Suspense } from "react";
import type { Metadata } from "next";
import { publicOrigin } from "@/lib/brand";
import LegalReader from "@/app/components/legal/LegalReader";
export const metadata: Metadata = { title: { absolute: "Terms & Conditions — ManForth by B1-Way" }, alternates: { canonical: `${publicOrigin()}/terms` }, robots: { index: false, follow: true } };
export default function Page() { return <Suspense fallback={<p className="p-8" role="status">Loading Terms & Conditions…</p>}><LegalReader kind="terms" /></Suspense>; }
