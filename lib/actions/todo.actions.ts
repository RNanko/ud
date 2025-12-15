"use server";
import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { kanbanBoard } from "../db/schema";
import { eq } from "drizzle-orm";

const rawData = [
  { id: "backlog", title: "Backlog", items: [] },
  { id: "todo", title: "To Do", items: [] },
  { id: "in-progress", title: "In Progress", items: [] },
  { id: "done", title: "Done", items: [] },
];

interface Item {
  id: string;
  content: string;
}

interface Container {
  id: string;
  title: string;
  items: Item[];
}

export async function getToDoList() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return [];
  }

  const existing = await db.query.kanbanBoard.findFirst({
    where: eq(kanbanBoard.userId, userId),
  });

  // 🟢 Return existing board
  if (existing) {
    return existing.data as Container[];
  }

  // 🆕 Create empty board
  await db.insert(kanbanBoard).values({
    id: crypto.randomUUID(),
    userId,
    data: rawData,
  });

  return rawData;
}

export async function updateToDoList(data: Container[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  const existing = await db.query.kanbanBoard.findFirst({
    where: eq(kanbanBoard.userId, userId),
  });

  if (existing) {
    await db
      .update(kanbanBoard)
      .set({ data })
      .where(eq(kanbanBoard.userId, userId));
  } else {
    await db.insert(kanbanBoard).values({
      id: crypto.randomUUID(),
      userId,
      data,
    });
  }

  return { success: true };
}
