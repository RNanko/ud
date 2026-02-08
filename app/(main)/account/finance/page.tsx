import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinanceFormExpens from "./finance-form-expense";
import FinanceFormIncome from "./finance-form-income";

import { getFinanceData } from "@/lib/actions/finance.actions";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import FinanceListFilter from "./finance-list-filter";
import { Suspense } from "react";
import Loader from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChartBar } from "lucide-react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Finance />
    </Suspense>
  );
}

export async function Finance() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userSessionId = session?.session?.userId;

  const data = await getFinanceData(userSessionId);

  return (
    <section className="flex flex-col xl:flex-row justify-center gap-5">
      <div className="xl:w-3/5">
        <Tabs defaultValue="expenses">
          <TabsList className="w-full flex gap-10 mb-5">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            <FinanceFormExpens />
          </TabsContent>

          <TabsContent value="income">
            <FinanceFormIncome />
          </TabsContent>
        </Tabs>
      </div>

      <div className="w-full mt-5 xl:mt-0">
        <div className="flex flex-row items-center justify-center gap-3 pb-5">
          <h2 className="text-center">Your Finance</h2>
          <Button variant={"destructive"} asChild className="flex flex-row">
            <Link href="/account/finance/chart">
              Chart
              <ChartBar />
            </Link>
          </Button>
        </div>
        <FinanceListFilter data={data} />
      </div>
    </section>
  );
}
