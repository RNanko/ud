import { Suspense } from "react";
import ChartBarNegative from "./chart";
import Loader from "@/app/components/shared/loader";
import { getChartIncomeOutcomeSnapshot } from "@/lib/actions/finance.actions";
import { requireUserId } from "@/lib/session";

// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Chart />
    </Suspense>
  );
}

async function Chart() {
  const owner = await requireUserId();
  const { data, currency } = await getChartIncomeOutcomeSnapshot(owner);

  return (
    <section>
      <ChartBarNegative chartData={data} currency={currency} />
    </section>
  );
}
