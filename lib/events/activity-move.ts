import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSql } from "../account/store";
import { calendarDay, timezoneSchema } from "../gym/validation";
import { timingSchema } from "../planner-time";
import { weekKey, weekdays } from "../events";
import { moveWorkoutPlan } from "./workout-move";
import { readActivityRecord } from "./activity-record";
import { writeScheduledOccurrence } from "./schedule-store";
const schema = z.object({ operationId: z.uuid(), id: z.string().min(1).max(220), from: calendarDay, date: calendarDay,
  version: z.string().min(1).max(20000), timezone: timezoneSchema, timing: timingSchema.optional() }).strict();
/** Shared source operation for Actions and Events. Overlap warnings are a
 * preview concern, never a reason to reject a valid desired-state move. */
export async function rescheduleCanonicalActivity(owner: string, input: unknown) {
  const value = schema.parse(input);
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind: "move-activity", value })).digest("hex");
  if (value.id.startsWith("workout:plan:")) {
    const receipt = (await accountSql`SELECT fingerprint FROM b1_activity_operations WHERE user_id=${owner} AND operation_id=${value.operationId}::uuid`)[0];
    if (receipt && receipt.fingerprint !== fingerprint) throw new Error("This operation identifier was already used for another move.");
    if (!receipt) {
      const current = await readActivityRecord(owner, value.id, value.from);
      if (current.occurrence.date !== value.from || current.occurrence.version !== value.version)
        throw new Error("Newer workout changes exist. Reload before moving it.");
    }
    const planRevision = value.version.startsWith("virtual:") ? -1 : Number(value.version.split(":")[0]);
    await moveWorkoutPlan(owner, { id: value.id.slice(13), mutationId: value.operationId, revision: planRevision,
      from: value.from, date: value.date, timezone: value.timezone, timing: value.timing }, fingerprint);
  } else if (value.id.startsWith("event:scheduled:")) {
    const receipt = (await accountSql`SELECT fingerprint,result FROM b1_event_schedule_operations WHERE user_id=${owner} AND operation_id=${value.operationId}::uuid`)[0];
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new Error("This operation identifier was already used for another move.");
      return readActivityRecord(owner, value.id, value.date);
    }
    const current = await readActivityRecord(owner, value.id, value.from);
    if (!current.event || current.occurrence.version !== value.version || current.occurrence.date !== value.from)
      throw new Error("Newer event changes exist. Reload before moving it.");
    await writeScheduledOccurrence(owner, { operationId: value.operationId, before: current.event,
      event: { ...current.event, ...(value.timing ? { timing: value.timing } : {}) }, date: value.date }, fingerprint);
  } else if (value.id.startsWith("event:")) {
    if (!(await accountSql`SELECT to_regprocedure('public.b1_move_event_activity(text,uuid,text,text,text,text,jsonb,jsonb)') AS function`)[0]?.function)
      throw new Error("Event moves need the 0051 database update before saving.");
    const receipt = (await accountSql`SELECT fingerprint FROM b1_activity_operations WHERE user_id=${owner} AND operation_id=${value.operationId}::uuid`)[0];
    if (receipt && receipt.fingerprint !== fingerprint) throw new Error("This operation identifier was already used for another move.");
    if (!receipt) {
      const current = await readActivityRecord(owner, value.id, value.from);
      if (!current.event || current.occurrence.version !== value.version || current.occurrence.date !== value.from)
        throw new Error("Newer event changes exist. Reload before moving it.");
      const event = { ...current.event, ...(value.timing ? { timing: value.timing } : {}) };
      const day = weekdays[(new Date(`${value.date}T12:00:00Z`).getUTCDay() + 6) % 7];
      await accountSql`SELECT b1_move_event_activity(${owner},${value.operationId}::uuid,${fingerprint},${weekKey(value.from)},${weekKey(value.date)},${day},${JSON.stringify(current.event)}::jsonb,${JSON.stringify(event)}::jsonb)`;
    }
  } else throw new Error("Choose a planned workout or Event to move. Recorded standalone workout dates are edited in Gym.");
  return readActivityRecord(owner, value.id, value.date);
}
