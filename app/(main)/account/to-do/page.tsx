import { getToDoList } from "@/lib/actions/todo.actions";
import KanbanClient from "./KanbanClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import Loader from "@/components/shared/loader";
import { Suspense } from "react";


export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ToDo />
    </Suspense>
  );
}

async function ToDo() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userSessionId = session?.session?.userId;

  const data = await getToDoList(userSessionId);

  return <KanbanClient data={data} />;
}
