import { getToDoList } from "@/lib/actions/todo.actions";
import KanbanClient from "./KanbanClient";
import { requireUserId } from "@/lib/session";

import Loader from "@/app/components/shared/loader";
import { Suspense } from "react";


// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ToDo />
    </Suspense>
  );
}

async function ToDo() {
  const userSessionId = await requireUserId();

  const data = await getToDoList(userSessionId);

  return <KanbanClient data={data} />;
}
