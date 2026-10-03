import { Suspense } from "react";
import { requireUserId } from "@/lib/session";
import AppLoading from "@/app/components/shared/AppLoading";
import MomentumClient from "./MomentumClient";
async function Momentum() { await requireUserId(); return <MomentumClient />; }
export default function Page() { return <Suspense fallback={<AppLoading label="Loading Momentum…" />}><Momentum /></Suspense>; }
