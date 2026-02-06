import Loader from "@/components/shared/loader";
import GetAccountData from "@/lib/actions/account.actions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";
import AvatarSection from "./AvatarSection";
import { getChartIncomeOutcomeData } from "@/lib/actions/finance.actions";
import ChartBarNegative from "./finance/chart/chart";
import { getToDoList } from "@/lib/actions/todo.actions";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getQuote } from "@/lib/actions/quotes.actions";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return <div>Not authenticated</div>;
  }

  const user = await GetAccountData(userId);

  if (!user) {
    return <div>User not found</div>;
  }

  const chartData = await getChartIncomeOutcomeData(userId, true);

  const todoList = await getToDoList(userId);
  const todoData = todoList.find((item) => item.title === "To Do");

  const quote = await getQuote();

  return (
    <section
      className="w-full flex flex-col lg:flex-row flex-wrap justify-between items-center 
      gap-3 sm:gap-10 p-1 sm:py-5"
    >
      <Card className="flex flex-col sm:flex-row gap-3 sm:gap-10 max-w-full justify-around p-5">
        <div className="self-center">
          <AvatarSection image={user.image ?? undefined} />
        </div>

        <div className="bg-accent p-5 rounded-2xl space-y-2 self-center">
          <p className="text-lg">
            Account: <span className="font-bold uppercase">{user.name}</span>
          </p>

          <p className="text-sm xl:text-xl">{user.email}</p>
          <time className="text-sm xl:text-xl">
            Created at: {user.createdAt.toLocaleDateString()}
          </time>
        </div>
      </Card>

      {/* CHART */}
      <div className="text-center min-w-80 space-y-5">
        <ChartBarNegative chartData={chartData} small />
      </div>

      {/* TODO */}
      <Link href="/account/to-do">
        <Card className="flex h-full text-center min-w-80 flex-col rounded-md border px-5">
          <h3 className="font-medium">{todoData?.title}</h3>
          {todoData?.items.length === 0 && (
            <p className="text-muted-foreground">No data yet</p>
          )}
          <ul className="flex flex-col gap-2">
            {todoData?.items.map((item) => (
              <li
                key={item.id}
                className="
                rounded border bg-gray-900 p-3
                dark:border-gray-800
              "
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg text-white wrap-break-word">
                    {item.content}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </Link>

      {/* NOTE */}
      <Card className="p-5 text-center">
        <h2>Quick Note</h2>

        <div className="flex items-center justify-center">
          <Button
            asChild
            variant="secondary"
            className="w-20 h-20 rounded-full hover:scale-105 active:scale-95 transition-transform"
          >
            <Link href="/account/notes?new=1">
              <Plus className="w-8 h-8" />
            </Link>
          </Button>
        </div>
      </Card>
        
        {/* QUOTE */}
      <Card className="p-4 h-fit mx-auto">
        <CardContent className="italic text-lg">“{quote!.quote}”</CardContent>
        <CardFooter className="justify-end text-xl text-muted-foreground">
          — {quote!.author}
        </CardFooter>
      </Card>
    </section>
  );
}
