import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSql } from "../account/store";
import { calendarDay, recordId, timezoneSchema } from "../gym/validation";
import { timingSchema } from "../planner-time";
import { projectedWorkoutPlans } from "./scheduled-workouts";
import { readScheduledOccurrences } from "./schedule-store";
import { scheduledWorkoutId } from "./scheduled-workouts";
import type { PlanRecord } from "../gym/types";

const schema = z.object({ id: recordId, mutationId: z.uuid(), revision: z.number().int().min(-1), from: calendarDay,
  date: calendarDay, timezone: timezoneSchema, timing: timingSchema.optional(),
}).strict();
export async function moveWorkoutPlan(owner: string, input: unknown, operationFingerprint?: string): Promise<PlanRecord> {
  const value = schema.parse(input), hash = operationFingerprint ?? createHash("sha256").update(JSON.stringify(value)).digest("hex");
  if (!(await accountSql`SELECT to_regprocedure('public.b1_move_workout_activity(text,uuid,text,text,jsonb,date,text,jsonb)') AS function`)[0]?.function)
    throw new Error("Workout moves need the 0044 database update before saving.");
  const receipt = (await accountSql`SELECT fingerprint,result FROM b1_activity_operations WHERE user_id=${owner} AND operation_id=${value.mutationId}::uuid`)[0];
  if (receipt) {
    if (receipt.fingerprint !== hash) throw new Error("Choose a new operation identifier for a different move.");
    return receipt.result as PlanRecord;
  }
  const rows = await accountSql`SELECT id,date::text,timezone,data,revision FROM gym_plans WHERE user_id=${owner} AND id=${value.id} AND NOT archived`;
  const plan = (rows[0] ?? (await projectedWorkoutPlans(owner, value.from, value.from)).find(p => p.id === value.id)) as PlanRecord | undefined;
  if (!plan || plan.revision !== value.revision || plan.date !== value.from) throw new Error("Newer workout changes exist. Reload before moving it.");
  const data = { ...plan.data, ...(value.timing ? { timing: value.timing } : {}) };
  return (await accountSql`SELECT b1_move_workout_activity(${owner},${value.mutationId}::uuid,${hash},${value.id},${JSON.stringify(plan)}::jsonb,${value.date}::date,${value.timezone},${JSON.stringify(data)}::jsonb) AS result`)[0].result as PlanRecord;
}

export async function cancelScheduledWorkout(owner: string, input: unknown) {
  const value = z.object({ id: recordId, date: calendarDay, mutationId: z.uuid() }).strict().parse(input);
  const hash = createHash("sha256").update(JSON.stringify({ cancelWorkout: value })).digest("hex");
  const receipt = (await accountSql`SELECT fingerprint FROM b1_event_schedule_operations WHERE user_id=${owner} AND operation_id=${value.mutationId}::uuid`)[0];
  if (receipt) {
    if (receipt.fingerprint !== hash) throw new Error("Choose a new operation identifier.");
    return;
  }
  const occurrence = (await readScheduledOccurrences(owner, value.date, value.date)).find(row => row.event.workout && scheduledWorkoutId(row.event.scheduled!) === value.id);
  if (!occurrence) throw new Error("Workout schedule is unavailable. Reload before removing it.");
  const ref = occurrence.event.scheduled!;
  // A tiny cancellation exception prevents a virtual occurrence from reappearing.
  // No plan or session is created just to remove an untouched calendar entry.
  await accountSql`SELECT b1_cancel_virtual_workout(${owner},${value.mutationId}::uuid,${hash},${value.id},${JSON.stringify(ref)}::jsonb,${value.date}::date)`;
}
