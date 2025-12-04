import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinanceFormExpens from "./finance-form-expense";
import FinanceFormIncome from "./finance-form-income";
import FinanceList from "./finance-list";
import { getFinanceData } from "@/lib/actions/finance.actions";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Finance() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userSessionId = session?.session?.userId;

  const data = await getFinanceData(userSessionId);


  return (
    <section className="flex flex-col gap-5 xl:flex xl:flex-row">
      <div className="w-full p-5">
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

      <div className="w-full">
        <FinanceList data={data} />
      </div>
    </section>
  );
}
