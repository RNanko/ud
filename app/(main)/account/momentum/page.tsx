import { Suspense } from "react";
import { requireUserId } from "@/lib/session";
import AppLoading from "@/app/components/shared/AppLoading";
import MomentumClient from "./MomentumClient";
type Query = Promise<Record<string, string | string[] | undefined>>;
async function Momentum({ searchParams }: { searchParams: Query }) {
  await requireUserId();
  const query = await searchParams;
  return (
    <MomentumClient
      key={JSON.stringify([query.view, query.goal, query.journey, query.week])}
    />
  );
}
export default function Page({ searchParams }: { searchParams: Query }) {
  return (
    <Suspense fallback={<AppLoading label="Loading Momentum…" />}>
      <Momentum searchParams={searchParams} />
    </Suspense>
  );
}
