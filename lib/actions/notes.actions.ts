"use server";
import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { userNotes } from "../db/schema";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { NoteItem } from "@/types/types";

export async function getNotes(userId: string) {
  "use cache";
  cacheTag("notes-data");
  cacheLife({ expire: 3600, revalidate: 900, stale: 300 });


  if (!userId) return [];

  const existing = await db.query.userNotes.findFirst({
    where: eq(userNotes.userId, userId),
  });

  if (existing) {
    return existing.data;
  }

  await db.insert(userNotes).values({
    id: crypto.randomUUID(),
    userId,
    data: [],
  });

  return [];
}


export async function updateNotes(data: NoteItem[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  const existing = await db.query.userNotes.findFirst({
    where: eq(userNotes.userId, userId),
  });

  if (existing) {
    await db
      .update(userNotes)
      .set({ data })
      .where(eq(userNotes.userId, userId));
  } else {
    await db.insert(userNotes).values({
      id: crypto.randomUUID(),
      userId,
      data,
    });
  }

  updateTag("notes-data");
  return { success: true };
}
