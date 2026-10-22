import { getToDoList } from "@/lib/actions/todo.actions";
import KanbanClient from "./KanbanClient";
import { requireUserId } from "@/lib/session";

import Loader from "@/app/components/shared/loader";
import { Suspense } from "react";


// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export default function Page() {
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-plus">Your next steps</p>
        <h1 className="text-3xl font-semibold">To-do</h1>
        <p className="text-sm text-muted-foreground">Capture tasks, set priorities, and move work forward.</p>
      </header>
      <Suspense fallback={<Loader />}>
        <ToDo />
      </Suspense>
    </section>
  );
}

async function ToDo() {
  const userSessionId = await requireUserId();

  const data = await getToDoList(userSessionId);

  return <KanbanClient data={data} />;
}
