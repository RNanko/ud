"use server";
import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { userEvents } from "../db/schema";
import { and, eq, notLike, desc } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { DefaultWeek, EventItems } from "@/types/types";
import { requireUserId } from "../session";

export async function getEventsList(userId: string, week: string) {
  return getCachedEventsList(await requireUserId(userId), week);
}

async function getCachedEventsList(userId: string, week: string) {
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

  // Reading an empty week must not create duplicate calendar rows.
  if (week === "default") {
    const defaultData: DefaultWeek[] = [
      { day: "Monday", workday: true },
      { day: "Tuesday", workday: true },
      { day: "Wednesday", workday: true },
      { day: "Thursday", workday: true },
      { day: "Friday", workday: true },
      { day: "Saturday", workday: false },
      { day: "Sunday", workday: false },
    ];

    return defaultData;
  }

  return [];
}

export async function getUserEventsList(week: string): Promise<EventItems[]> {
  const userId = await requireUserId();

  const existing = await db.query.userEvents.findFirst({
    where: and(
      eq(userEvents.userId, userId),
      eq(userEvents.week, week)
    ),
  });

  return (existing?.data ?? []) as EventItems[];
}


export async function updateEventsList(data: EventItems[], week: string) {
  void data; void week;
  await requireUserId(undefined,"write");
  // Old tabs have no expected snapshot and cannot safely overwrite the current board.
  return { success: false, message: "Reload Events before saving. This older editor is no longer supported." };
}

export async function setDefaultWeekEvents(data: EventItems[]) {
  void data;
  await requireUserId(undefined,"write");
  return { success: false, message: "Reload Events and use named week presets. This older editor is no longer supported." };
}

export async function getDefaultWeekEvents() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return { success: false, data: [] as EventItems[] };
  }

  const existing = await db.query.userEvents.findFirst({
    where: and(
      eq(userEvents.userId, userId),
      eq(userEvents.week, "default-WK"),
    ),
  });

  return {
    success: true,
    data: (existing?.data ?? []) as EventItems[],
  };
}

export async function getListOfWeeks(userId: string) {
  userId = await requireUserId(userId);
  const weeks = await db
    .selectDistinct({
      week: userEvents.week,
    })
    .from(userEvents)
    .where(
      and(eq(userEvents.userId, userId), notLike(userEvents.week, "%default%"), notLike(userEvents.week, "%presets%")),
    )
    .orderBy(desc(userEvents.week));

  return {
    success: true,
    data: weeks.map((w) => w.week),
  };
}
