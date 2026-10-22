import "server-only";
import { createHash } from "node:crypto";
import { accountSql } from "../account/store";
import { readScheduledOccurrences } from "./schedule-store";
import type { PlanRecord } from "../gym/types";
import { occurrenceKey, type ScheduleRef } from "./recurrence";

export function scheduledWorkoutId(ref: ScheduleRef) {
  const hash = createHash("sha256").update(occurrenceKey(ref.scheduleId, ref.originalDate, ref.slotId)).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export async function projectedWorkoutPlans(owner: string, from: string, to: string): Promise<PlanRecord[]> {
  const occurrences = await readScheduledOccurrences(owner, from, to);
  const workouts = occurrences.filter(o => o.event.workout);
  if (!workouts.length) return [];
  const ids = workouts.map(o => scheduledWorkoutId(o.event.scheduled!));
  const mappings = await accountSql`SELECT plan_id FROM b1_scheduled_workouts WHERE user_id=${owner} AND plan_id=ANY(${ids}::text[])`;
  const materialized = new Set(mappings.map(row => row.plan_id));
  return workouts.filter(o => !materialized.has(scheduledWorkoutId(o.event.scheduled!))).map(({date,event}) => ({
    id: scheduledWorkoutId(event.scheduled!), date, timezone: event.scheduled!.timezone, revision: -1,
    data: { ...event.workout!, name: event.title, timing: event.timing, scheduled: event.scheduled },
  }));
}
/** Called only by a write; calendar reads never materialize plans. */
export async function materializeScheduledWorkout(owner: string, id: string, date: string) {
  const plan = (await projectedWorkoutPlans(owner,date,date)).find(p => p.id === id);
  if (!plan) throw new Error("Workout schedule is unavailable. Reload this week.");
  const ref = plan.data.scheduled!;
  await accountSql`SELECT b1_materialize_scheduled_workout(${owner},${id},${ref.scheduleId}::uuid,${ref.originalDate}::date,${ref.slotId ?? "main"},${ref.scheduleRevision},${ref.revision},${date}::date,${plan.timezone},${JSON.stringify(plan.data)}::jsonb)`;
}
