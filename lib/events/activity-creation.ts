import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSql } from "../account/store";
import { eventSchema, weekKey, weekdays } from "../events";
import { calendarDay } from "../gym/validation";
import { projectedWorkoutPlans } from "./scheduled-workouts";
import { readActivityRecord } from "./activity-record";

const eventInput = eventSchema.omit({ id: true, completed: true, completedAt: true, workout: true, workoutLink: true, kind: true }).strict();
const createSchema = z.object({ operationId: z.uuid(), date: calendarDay, event: eventInput }).strict();
const activateSchema = z.object({ operationId: z.uuid(), id: z.string().regex(/^workout:plan:[a-f0-9-]{36}$/), date: calendarDay, version: z.string().max(100) }).strict();
const hash = (kind: string, value: unknown) => createHash("sha256").update(JSON.stringify({ kind, value })).digest("hex");
async function replay(owner: string, operation: string, fingerprint: string) {
  const rows = await accountSql`SELECT fingerprint,result FROM b1_activity_operations WHERE user_id=${owner} AND operation_id=${operation}::uuid`;
  if (!rows.length) return false;
  if (rows[0].fingerprint !== fingerprint) throw new Error("This operation identifier was already used for another change.");
  return true;
}
async function ready() {
  if (!(await accountSql`SELECT to_regprocedure('public.b1_create_event_activity(text,uuid,text,text,text,jsonb)') AS function`)[0]?.function)
    throw new Error("Activity creation needs the 0050 database update before saving.");
}
/** Ordinary Events owns this record; this adapter never copies a linked workout. */
export async function createCanonicalEvent(owner: string, input: unknown) {
  const value = createSchema.parse(input), fingerprint = hash("create-event", value);
  await ready();
  if (!await replay(owner, value.operationId, fingerprint)) {
    const event = { ...value.event, id: value.operationId, kind: "manual", completed: false, completedAt: null };
    const day = weekdays[(new Date(`${value.date}T12:00:00Z`).getUTCDay() + 6) % 7];
    await accountSql`SELECT b1_create_event_activity(${owner},${value.operationId}::uuid,${fingerprint},${weekKey(value.date)},${day},${JSON.stringify(event)}::jsonb)`;
  }
  return readActivityRecord(owner, `event:${value.operationId}`, value.date);
}
/** An explicit activation creates one plan, with zero required exercise details.
 * Calendar reads never call this. Replays return the current canonical record. */
export async function activateCanonicalWorkout(owner: string, input: unknown) {
  const value = activateSchema.parse(input), fingerprint = hash("activate-workout", value);
  await ready();
  if (!await replay(owner, value.operationId, fingerprint)) {
    const plan = (await projectedWorkoutPlans(owner, value.date, value.date)).find(row => `workout:plan:${row.id}` === value.id);
    if (!plan || `virtual:${plan.data.scheduled!.scheduleRevision}:${plan.data.scheduled!.revision}` !== value.version)
      throw new Error("Newer workout changes exist. Reload before activating it.");
    await accountSql`SELECT b1_activate_workout_activity(${owner},${value.operationId}::uuid,${fingerprint},${JSON.stringify(plan)}::jsonb)`;
  }
  return readActivityRecord(owner, value.id, value.date);
}
