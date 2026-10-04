"use server";
import db from "../db/drizzle";
import { kanbanBoard } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { requireUserId } from "../session";
import { emptyTodoBoard, sameTodoBoard, todoBoardSchema, type TodoBoard, type TodoSaveResult } from "../todo";


export async function getToDoList(userId?: string) {
  return getCachedToDoList(await requireUserId(userId));
}

async function getCachedToDoList(userId: string) {
  "use cache";
  cacheTag("todo-data");
  cacheLife({ expire: 3600, revalidate: 900, stale: 300 });

  if (!userId) return [];

  const existing = await db.query.kanbanBoard.findFirst({
    where: eq(kanbanBoard.userId, userId),
  });

  // Return existing board
  if (existing) {
    return existing.data as TodoBoard;
  }

  // An empty board is virtual until its first authorized save.
  return emptyTodoBoard();
}

export async function updateToDoList(data: TodoBoard, previous: TodoBoard): Promise<TodoSaveResult> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  try{await requireUserId(userId,"write");}catch(error){return {success:false,message:error instanceof Error?error.message:"Membership is read-only"};}
  const next = todoBoardSchema.safeParse(data), before = todoBoardSchema.safeParse(previous);
  if (!next.success || !before.success) return { success: false, message: "Invalid task board." };
  try {
    const existing = await db.query.kanbanBoard.findFirst({ where: eq(kanbanBoard.userId, userId) });
    if (!existing) {
      if (!sameTodoBoard(before.data, emptyTodoBoard())) return { success: false, conflict: true, message: "Reload your task board." };
      const inserted = await db.insert(kanbanBoard).values({ id: `todo:${userId}`, userId, data: next.data })
        .onConflictDoNothing().returning({ id: kanbanBoard.id });
      if (inserted.length) {
        updateTag("todo-data");
        return { success: true, data: next.data };
      }
      const latest = await db.query.kanbanBoard.findFirst({ where: eq(kanbanBoard.userId, userId) });
      if (latest && sameTodoBoard(latest.data as TodoBoard, next.data)) return { success: true, data: next.data };
      return { success: false, conflict: true, message: "Board changed elsewhere. Latest saved tasks restored.", data: latest?.data as TodoBoard | undefined };
    }
    // A retry after an ambiguous network failure is already saved; never duplicate it.
    if (sameTodoBoard(existing.data as TodoBoard, next.data)) return { success: true, data: next.data };
    const rows = await db.update(kanbanBoard).set({ data: next.data }).where(and(
      eq(kanbanBoard.id, existing.id), eq(kanbanBoard.userId, userId), eq(kanbanBoard.data, before.data)
    )).returning({ id: kanbanBoard.id });
    if (!rows.length) {
      const latest = await db.query.kanbanBoard.findFirst({ where: eq(kanbanBoard.userId, userId) });
      return { success: false, conflict: true, message: "Board changed elsewhere. Latest saved tasks restored.", data: latest?.data as TodoBoard | undefined };
    }
    updateTag("todo-data");
    return { success: true, data: next.data };
  } catch {
    return { success: false, message: "Changes could not be saved. Try again." };
  }
}
