"use client";

import dynamic from "next/dynamic";

const KanbanBoard = dynamic(() => import("./KanbanBoard"), {
  ssr: false,
});

interface Item {
  id: string;
  content: string;
}

interface Container {
  id: string;
  title: string;
  items: Item[];
}

export default function KanbanClient({ data }: { data: Container[] }) {
  return <KanbanBoard data={data} />;
}
