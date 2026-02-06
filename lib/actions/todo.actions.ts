"use server";
import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { kanbanBoard } from "../db/schema";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";

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

export async function getToDoList(userId?: string) {
  "use cache";
  cacheTag("todo-data");
  cacheLife({ expire: 3600, revalidate: 900, stale: 300 });

  if (!userId) return [];

  const existing = await db.query.kanbanBoard.findFirst({
    where: eq(kanbanBoard.userId, userId),
  });

  // Return existing board
  if (existing) {
    return existing.data as Container[];
  }

  // Create empty board
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
  updateTag("todo-data");

  return { success: true };
}
