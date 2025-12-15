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
// const DATA = [
//   {
//     id: "backlog",
//     title: "Backlog",
//     items: [
//       { id: "task-11", content: "Look into render bug in dashboard" },
//       { id: "task-22", content: "SOX compliance checklist" },
//       { id: "task-33", content: "[SPIKE] Migrate to Azure" },
//     ],
//   },
//   {
//     id: "todo",
//     title: "To Do",
//     items: [
//       { id: "task-1", content: "Research @dnd-kit" },
//       { id: "task-2", content: "Create basic example" },
//       { id: "task-3", content: "Write tutorial" },
//     ],
//   },
//   {
//     id: "in-progress",
//     title: "In Progress",
//     items: [{ id: "task-4", content: "Record demo video" }],
//   },
//   {
//     id: "done",
//     title: "Done",
//     items: [{ id: "task-5", content: "Setup project" }],
//   },
// ];
