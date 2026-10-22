"use server";

import z from "zod";
import { and, eq, sql } from "drizzle-orm";
import db from "../db/drizzle";
import { gymPlans, gymSessions, userEvents } from "../db/schema";
import { requireUserId } from "../session";
import { weekSchema, weekDate, weekdays } from "../events";
import { addCalendarDays } from "../gym/dates";
import type { EventItem, EventItems } from "@/types/types";

export type LinkedWorkoutEvent = { event: EventItem; date: string };

export async function getWorkoutEvents(input: unknown): Promise<LinkedWorkoutEvent[]> {
  const owner = await requireUserId();
  const value = z.object({ kind: z.enum(["plan", "session"]), id: z.uuid() }).strict().parse(input);
  const table = value.kind === "plan" ? gymPlans : gymSessions;
  const owned = await db.select().from(table).where(and(eq(table.userId, owner), eq(table.id, value.id), eq(table.archived, false)));
  if (!owned.length) throw new Error("Workout is no longer available.");
  const links = [value];
  if (value.kind === "session") {
    const session = owned[0] as typeof gymSessions.$inferSelect;
    if (session.planId) links.push({ kind: "plan", id: session.planId });
  } else {
    const sessions = await db.select({ id: gymSessions.id }).from(gymSessions).where(and(
      eq(gymSessions.userId, owner), eq(gymSessions.planId, value.id), eq(gymSessions.archived, false),
    ));
    for (const session of sessions) links.push({ kind: "session", id: session.id });
  }
  const rows = await db.select({ week: userEvents.week, data: userEvents.data }).from(userEvents).where(and(
    eq(userEvents.userId, owner), sql`${userEvents.week} ~ '^[0-9]{4}-WK[0-9]{1,2}$'`,
    sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${userEvents.data}) AS day,
      jsonb_array_elements(day->'tasks') AS task WHERE task->'workoutLink' IN
      (${sql.join(links.map(link => sql`${JSON.stringify(link)}::jsonb`), sql`, `)}))`,
  ));
  return rows.flatMap(row => {
    if (!weekSchema.safeParse(row.week).success) return [];
    const start = weekDate(row.week);
    return (row.data as EventItems[]).flatMap(day => day.tasks.filter(event => links.some(link =>
      event.workoutLink?.kind === link.kind && event.workoutLink.id === link.id,
    )).map(event => ({ event, date: addCalendarDays(start, weekdays.indexOf(day.day)) })));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.event.title.localeCompare(b.event.title));
}
