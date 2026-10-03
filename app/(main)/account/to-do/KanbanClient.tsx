"use client";

import dynamic from "next/dynamic";
import type { TodoBoard } from "@/lib/todo";

const KanbanBoard = dynamic(() => import("./KanbanBoard"), {
  ssr: false,
});

export default function KanbanClient({ data }: { data: TodoBoard }) {
  return <KanbanBoard data={data} />;
}
