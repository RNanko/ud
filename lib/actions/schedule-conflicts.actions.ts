"use server";
import { z } from "zod";
import { requireUserId } from "../session";
import { accountSettings } from "../account/store";
import { addCalendarDays } from "../calendar";
import { timingSchema } from "../planner-time";
import { readCanonicalActivityRange } from "../events/activity-range";
import { activityConflicts } from "../events/activity-conflicts";

// Scheduling previews read only Events and Gym records.
export async function getScheduleConflicts(input: unknown) {
  const owner = await requireUserId();
  const payload = z.object({ source: z.object({ kind: z.enum(["event", "workout"]), id: z.string().min(1).max(200), week: z.string().max(20).optional() }).strict(), date: z.iso.date(), timing: timingSchema.optional() }).strict().parse(input);
  const from = addCalendarDays(payload.date, -1), to = addCalendarDays(payload.date, 1);
  const settings = await accountSettings(owner);
  const events = await readCanonicalActivityRange(owner, { from, to }, settings.preferences.timezone);
  if (events.length > 1000) throw new Error("The schedule preview is too large. Review the destination in Events.");
  const moving = payload.source.kind === "event" ? `event:${payload.source.id}` : payload.source.id.startsWith("session:") ? `workout:${payload.source.id}` : `workout:plan:${payload.source.id}`;
  return { ...activityConflicts(events, moving, payload.source.id, payload.date, payload.timing), input: JSON.stringify(input) };
}
