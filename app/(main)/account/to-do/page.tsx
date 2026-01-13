import { getToDoList } from "@/lib/actions/todo.actions";
import KanbanClient from "./KanbanClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userSessionId = session?.session?.userId;

  const data = await getToDoList(userSessionId);

  return <KanbanClient data={data} />;
}
