import { Suspense } from "react";
import ChartBarNegative from "./chart";
import Loader from "@/components/shared/loader";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getChartIncomeOutcomeData } from "@/lib/actions/finance.actions";

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

  const data = await getChartIncomeOutcomeData(userSessionId!);

  return (
    <section>
      <ChartBarNegative chartData={data} />
    </section>
  );
}
