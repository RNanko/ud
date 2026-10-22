import "server-only";
import { and, eq } from "drizzle-orm";
import db from "../db/drizzle";
import { gymPlans, gymSessions } from "../db/schema";
import type { EventItems } from "@/types/types";

// Only new or changed links need validation. Deleting/archiving a workout must
// not prevent editing an event that still holds its old reference.
export async function assertWorkoutLinks(owner: string, before: EventItems[], data: EventItems[]) {
  const old = new Map(before.flatMap(day => day.tasks.map(event => [event.id, event.workoutLink])));
  const links = new Map(data.flatMap(day => day.tasks.flatMap(event => {
    const link = event.workoutLink, previous = old.get(event.id);
    return link && (previous?.kind !== link.kind || previous?.id !== link.id)
      ? [[`${link.kind}:${link.id}`, link] as const] : [];
  })));
  for (const link of links.values()) {
    const table = link.kind === "plan" ? gymPlans : gymSessions;
    const rows = await db.select({ id: table.id }).from(table).where(and(
      eq(table.userId, owner), eq(table.id, link.id), eq(table.archived, false),
    ));
    if (!rows.length) throw new Error("Workout is no longer available. Choose another workout or remove its link.");
  }
}
