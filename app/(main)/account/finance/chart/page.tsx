import { Suspense } from "react";
import ChartBarNegative from "./chart";
import Loader from "@/app/components/shared/loader";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getChartIncomeOutcomeSnapshot } from "@/lib/actions/finance.actions";
import { requireUserId } from "@/lib/session";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Chart />
    </Suspense>
  );
}

async function Chart() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userSessionId = session?.session?.userId;

  const owner = await requireUserId(userSessionId);
  const { data, currency } = await getChartIncomeOutcomeSnapshot(owner);

  return (
    <section>
      <ChartBarNegative chartData={data} currency={currency} />
    </section>
  );
}
