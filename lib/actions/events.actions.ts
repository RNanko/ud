"use server";
import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { userEvents } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { DefaultWeek, EventItems } from "@/types/types";

export async function getEventsList(userId: string, week: string) {
  "use cache";
  cacheTag("events-data");
  cacheLife({ expire: 1, revalidate: 1, stale: 300 });

  if (!userId) return [];

  const existing = await db.query.userEvents.findFirst({
    where: and(eq(userEvents.userId, userId), eq(userEvents.week, week)),
  });

  // Return existing board
  if (existing) {
    return existing.data as EventItems[];
  }

  const existingDefault = await db.query.userEvents.findFirst({
    where: and(eq(userEvents.userId, userId), eq(userEvents.week, "default")),
  });

  // Return existing board
  if (!existingDefault) {
    const defaultData: DefaultWeek[] = [
      { day: "Monday", workday: true },
      { day: "Tuesday", workday: true },
      { day: "Wednesday", workday: true },
      { day: "Thursday", workday: true },
      { day: "Friday", workday: true },
      { day: "Saturday", workday: false },
      { day: "Sunday", workday: false },
    ];

    await db.insert(userEvents).values({
      id: crypto.randomUUID(),
      userId,
      week: "default",
      data: defaultData,
    });
  }

  const [inserted] = await db
    .insert(userEvents)
    .values({
      id: crypto.randomUUID(),
      userId,
      week,
      data: [],
    })
    .returning();

  return inserted.data
}

export async function updateEventsList(data: EventItems[], week: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return { success: false, message: "Not authenticated" };
  }

  const existing = await db.query.userEvents.findFirst({
    where: and(eq(userEvents.userId, userId), eq(userEvents.week, week)),
  });

  if (existing) {
    await db
      .update(userEvents)
      .set({ data })
      .where(and(eq(userEvents.userId, userId), eq(userEvents.week, week)));
  } else {
    await db.insert(userEvents).values({
      id: crypto.randomUUID(),
      userId,
      week,
      data,
    });
  }

  updateTag("events-data");

  return { success: true };
}
