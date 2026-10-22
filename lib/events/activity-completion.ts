import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSql, accountSettings } from "../account/store";
import { weekDate, weekKey, weekdays } from "../events";
import { addCalendarDays, dateInZone } from "../gym/dates";
import { calendarDay, sessionSchema } from "../gym/validation";
import { newSession } from "../gym/logic";
import { readScheduledOccurrences } from "./schedule-store";
import { individualEvent, scheduledItem } from "./recurrence";
import { readEventSchedules } from "./schedule-store";
import type { EventItem, EventItems } from "@/types/types";
import type { Blueprint, SessionData } from "../gym/types";
import { projectedWorkoutPlans } from "./scheduled-workouts";

export const activityCompletionSchema = z.object({
  operationId: z.uuid(), id: z.string().min(1).max(220), date: calendarDay,
  version: z.string().min(1).max(20000), completed: z.boolean(),
}).strict();
export type ActivityCompletion = z.infer<typeof activityCompletionSchema>;

/** A desired-state command, not a toggle. All writes and the receipt commit together. */
export async function completeActivity(owner: string, input: unknown, operationFingerprint?: string) {
  const value = activityCompletionSchema.parse(input);
  const hash = operationFingerprint ?? createHash("sha256").update(JSON.stringify(value)).digest("hex");
  if (!(await accountSql`SELECT to_regclass('public.b1_activity_operations') AS table`)[0]?.table)
    throw new Error("Activity checkboxes need the 0042 database update before saving.");
  const receipt = (await accountSql`SELECT fingerprint,result FROM b1_activity_operations WHERE user_id=${owner} AND operation_id=${value.operationId}::uuid`)[0];
  if (receipt) {
    if (receipt.fingerprint !== hash) throw new Error("This operation identifier was already used for another change.");
    return;
  }
  const settings = await accountSettings(owner), today = dateInZone(new Date(), settings.preferences.timezone);
  if (value.completed && value.date > today) throw new Error("Choose today or a past date to record completion.");
  const now = new Date().toISOString();
  let kind: "scheduled" | "event" | "workout", id: string, dateOrWeek = weekKey(value.date);
  let before: EventItem | SessionData | null = null, next: EventItem | SessionData;
  let plan: string | null = null, revision: number | null = null, planRevision: number | null = null;
  let schedule: string | null = null, original: string | null = null, scheduleRevision: number | null = null, slot = "main", restore = false;
  if (value.id.startsWith("event:scheduled:")) {
    kind = "scheduled"; id = value.id.slice(6); dateOrWeek = value.date;
    const occurrence = (await readScheduledOccurrences(owner, value.date, value.date)).find(o => o.event.id === id);
    if (!occurrence) throw new Error("This scheduled event is unavailable.");
    if (occurrence.event.workout || occurrence.event.kind === "training") throw new Error("Choose the canonical Gym workout to confirm training.");
    before = occurrence.event;
    const ref = before.scheduled!;
    if (`${ref.scheduleRevision}:${ref.revision}` !== value.version) throw new Error("Newer scheduled event changes exist. Reload before retrying.");
    next = { ...individualEvent(before), completed: value.completed, completedAt: value.completed ? before.completedAt ?? now : null };
    schedule = ref.scheduleId; original = ref.originalDate; revision = ref.revision; scheduleRevision = ref.scheduleRevision; slot = ref.slotId ?? "main";
    const rule = (await readEventSchedules(owner)).find(s => s.id === schedule)!;
    const template = scheduledItem(rule, original, undefined, slot);
    const clean = (event: EventItem) => { const copy = individualEvent(event); delete copy.completedAt; return JSON.stringify(copy); };
    restore = !value.completed && value.date === original && !!template && clean(next) === clean(template);
  } else if (value.id.startsWith("event:")) {
    kind = "event"; id = value.id.slice(6);
    const rows = await accountSql`SELECT data FROM user_events WHERE user_id=${owner} AND week=${dateOrWeek}`;
    const board = (rows[0]?.data ?? []) as EventItems[];
    const day = board.find(d => d.tasks.some(e => e.id === id));
    before = day?.tasks.find(e => e.id === id) ?? null;
    if (!before || !day || before.workout || before.kind === "training") throw new Error("This event is unavailable.");
    if (JSON.stringify(before) !== value.version || addCalendarDays(weekDate(dateOrWeek), weekdays.indexOf(day.day)) !== value.date)
      throw new Error("Newer event changes exist. Reload before retrying.");
    next = { ...before, completed: value.completed, completedAt: value.completed ? before.completedAt ?? now : null };
  } else {
    kind = "workout";
    const match = /^workout:(plan|session):([a-zA-Z0-9-]+)$/.exec(value.id);
    if (!match) throw new Error("Choose a supported activity.");
    const sessions = match[1] === "plan"
      ? await accountSql`SELECT id,data,plan_id,revision,archived FROM gym_sessions WHERE user_id=${owner} AND plan_id=${match[2]}`
      : await accountSql`SELECT id,data,plan_id,revision,archived FROM gym_sessions WHERE user_id=${owner} AND id=${match[2]}`;
    const session = sessions[0]; plan = match[1] === "plan" ? match[2] : session?.plan_id ?? null;
    const plans = plan ? await accountSql`SELECT id,data,date::text,timezone,revision FROM gym_plans WHERE user_id=${owner} AND id=${plan} AND NOT archived` : [];
    const virtual = !plans.length && plan ? (await projectedWorkoutPlans(owner,value.date,value.date)).find(p => p.id === plan) : undefined;
    const workout = plans[0] ?? virtual;
    if (session?.archived || !session && !workout || plan && !workout) throw new Error("This workout is unavailable.");
    const version = virtual ? `virtual:${virtual.data.scheduled!.scheduleRevision}:${virtual.data.scheduled!.revision}` : `${workout?.revision ?? "none"}:${session?.revision ?? "none"}`;
    if (version !== value.version || (workout?.date ?? session?.data.date) !== value.date)
      throw new Error("Newer workout changes exist. Reload before retrying.");
    id = session?.id ?? value.operationId; revision = session?.revision ?? null; planRevision = workout?.revision ?? null;
    before = session?.data as SessionData ?? null;
    const current = before ?? newSession(workout.data as Blueprint, value.date, workout.timezone, true, true);
    next = sessionSchema.parse({ ...current, status: value.completed ? "completed" : "active", completionMode: before?.completionMode ?? "confirmation", finishedAt: value.completed ? current.finishedAt ?? now : null, restUntil: null });
    // Reopening retains the canonical session, its identity and later details.
    // Restore-to-virtual would delete the session just confirmed by the user.
    if (virtual) {
      const ref = virtual.data.scheduled!;
      await accountSql`SELECT b1_complete_virtual_workout(${owner},${value.operationId}::uuid,${hash},${plan},${id},${ref.scheduleId}::uuid,${ref.originalDate}::date,${ref.slotId ?? "main"},${ref.scheduleRevision},${ref.revision},${value.date}::date,${virtual.timezone},${JSON.stringify(virtual.data)}::jsonb,${JSON.stringify(next)}::jsonb)`;
      return;
    }
  }
  await accountSql`SELECT b1_complete_activity(${owner},${value.operationId}::uuid,${hash},${kind},${id},${dateOrWeek},${before ? JSON.stringify(before) : null}::jsonb,${JSON.stringify(next)}::jsonb,${plan},${revision},${planRevision},${schedule}::uuid,${original}::date,${scheduleRevision},${slot},${restore})`;
}
