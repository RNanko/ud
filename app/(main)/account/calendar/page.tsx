import { getToDoList } from "@/lib/actions/todo.actions";
import KanbanClient from "./KanbanClient";

export default async function Page() {
  const data = await getToDoList();

  return <KanbanClient data={data} />;
}
