import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSql } from "../account/store";
import { eventSchema } from "../events";
import { calendarDay, timezoneSchema } from "../gym/validation";
import { assertWorkoutLinks } from "../gym/event-link-store";
import { eventScheduleSchema, individualEvent, occurrenceKey, scheduledItem, projectScheduledEvents, mergeScheduledBoard, type EventSchedule, type ScheduledOccurrence } from "./recurrence";
import type { EventItem, EventItems } from "@/types/types";

export async function schedulesReady() {
  return !!(await accountSql`SELECT to_regclass('public.b1_event_schedules') AS table`)[0]?.table;
}
export async function scheduleSlotsReady() {
  return !!(await accountSql`SELECT to_regprocedure('public.b1_write_event_schedule_v2(text,uuid,text,uuid,integer,jsonb,date,date,integer,text,boolean)') AS function`)[0]?.function;
}
export async function readEventSchedules(owner: string): Promise<EventSchedule[]> {
  if (!await schedulesReady()) return [];
  const rows = await accountSql`SELECT data FROM b1_event_schedules WHERE user_id=${owner} ORDER BY data->>'start',id LIMIT 1001`;
  if (rows.length > 1000) throw new Error("Too many event schedules to load. Contact support.");
  return rows.map(row => eventScheduleSchema.parse(row.data));
}
export async function readScheduledOccurrences(owner: string, from: string, to: string, schedules?: EventSchedule[]) {
  const rules = schedules ?? await readEventSchedules(owner);
  if (!rules.length) return [];
  const rows = await accountSql`SELECT data FROM b1_event_occurrences WHERE user_id=${owner} AND (date BETWEEN ${from}::date AND ${to}::date OR original_date BETWEEN ${from}::date AND ${to}::date) LIMIT 10001`;
  if (rows.length > 10000) throw new Error("Choose a smaller schedule date range.");
  return projectScheduledEvents(rules, rows.map(r => r.data as ScheduledOccurrence), from, to);
}
export async function withScheduledEvents(owner: string, board: EventItems[], dates: string[]) {
  return mergeScheduledBoard(board, dates, (await readScheduledOccurrences(owner, dates[0], dates.at(-1)!)).filter(o => !o.event.workout));
}
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])) : v;
const fingerprint = (v: unknown) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
const same = (a: unknown,b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
async function requireSchema() { if (!await schedulesReady()) throw new Error("Scheduled events need the 0040 database update before they can be saved."); }
async function receipt(owner: string, operation: string, hash: string) {
  const rows = await accountSql`SELECT fingerprint,result FROM b1_event_schedule_operations WHERE user_id=${owner} AND operation_id=${operation}::uuid`;
  if (rows.length && rows[0].fingerprint !== hash) throw new Error("This save identifier was already used. Reload before retrying.");
  return rows[0]?.result;
}
export async function createEventSchedule(owner: string, input: unknown) {
  const value = z.object({ operationId: z.uuid(), schedule: eventScheduleSchema }).strict().parse(input);
  await requireSchema();
  const hash = fingerprint(value), saved = await receipt(owner, value.operationId, hash);
  if (saved) return saved as EventSchedule;
  if (value.schedule.revision !== -1 || value.schedule.stoppedFrom) throw new Error("Choose a new schedule.");
  if (value.schedule.ownerGoalId || value.schedule.ownerActionId) throw new Error("Choose an independent schedule here. Goal-owned schedules must be created with their goal.");
  if (value.schedule.event.workout && !(await accountSql`SELECT to_regclass('public.b1_scheduled_workouts') AS table`)[0]?.table) throw new Error("Scheduled workouts need the 0043 database update before saving.");
  if ((value.schedule.slots?.some(slot => slot.id !== "main") || value.schedule.versions?.length) && !await scheduleSlotsReady()) throw new Error("Scheduled events need the 0041 database update before multiple slots can be saved.");
  const schedule = { ...value.schedule, event: { ...individualEvent(value.schedule.event), id: value.schedule.id, completed: false, completedAt: null } };
  return (await accountSql`SELECT b1_write_event_schedule(${owner},${value.operationId}::uuid,${hash},${schedule.id}::uuid,-1,${JSON.stringify(schedule)}::jsonb) AS data`)[0].data as EventSchedule;
}
export async function stopEventSchedule(owner: string, input: unknown) {
  const value = z.object({ operationId: z.uuid(), id: z.uuid(), revision: z.number().int().nonnegative(), from: calendarDay }).strict().parse(input);
  await requireSchema();
  const hash = fingerprint(value), saved = await receipt(owner, value.operationId, hash);
  if (saved) return saved as EventSchedule;
  const rows = await accountSql`SELECT data FROM b1_event_schedules WHERE user_id=${owner} AND id=${value.id}::uuid`;
  if (!rows.length) throw new Error("This schedule is unavailable.");
  const schedule = eventScheduleSchema.parse(rows[0].data);
  const data = { ...schedule, stoppedFrom: schedule.stoppedFrom && schedule.stoppedFrom < value.from ? schedule.stoppedFrom : value.from };
  return (await accountSql`SELECT b1_write_event_schedule(${owner},${value.operationId}::uuid,${hash},${value.id}::uuid,${value.revision},${JSON.stringify(data)}::jsonb) AS data`)[0].data as EventSchedule;
}
export async function writeScheduledOccurrence(owner: string, input: unknown, operationFingerprint?: string) {
  const value = z.object({ operationId: z.uuid(), before: eventSchema, event: eventSchema.nullable(), date: calendarDay }).strict().parse(input);
  const ref = z.object({ scheduleId: z.uuid(), originalDate: calendarDay, slotId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/).optional(), revision: z.number().int().min(-1), scheduleRevision: z.number().int().nonnegative(), timezone: timezoneSchema }).strict().parse(value.before.scheduled);
  await requireSchema();
  const hash = operationFingerprint ?? fingerprint(value), saved = await receipt(owner, value.operationId, hash);
  if (saved) return saved as ScheduledOccurrence;
  const rules = await accountSql`SELECT data FROM b1_event_schedules WHERE user_id=${owner} AND id=${ref.scheduleId}::uuid`;
  if (!rules.length) throw new Error("This schedule is unavailable.");
  const schedule = eventScheduleSchema.parse(rules[0].data);
  const slotsReady = await scheduleSlotsReady();
  if (ref.slotId && ref.slotId !== "main" && !slotsReady) throw new Error("Scheduled events need the 0041 database update before saving.");
  const rows = slotsReady
    ? await accountSql`SELECT data FROM b1_event_occurrences WHERE user_id=${owner} AND schedule_id=${ref.scheduleId}::uuid AND original_date=${ref.originalDate}::date AND slot_id=${ref.slotId ?? "main"}`
    : await accountSql`SELECT data FROM b1_event_occurrences WHERE user_id=${owner} AND schedule_id=${ref.scheduleId}::uuid AND original_date=${ref.originalDate}::date`;
  const current = scheduledItem(schedule, ref.originalDate, rows[0]?.data as ScheduledOccurrence | undefined, ref.slotId);
  if (!current || !same(current, value.before)) throw new Error("Newer scheduled event changes exist. Reload before retrying.");
  if (value.event && (value.event.id !== occurrenceKey(ref.scheduleId, ref.originalDate, ref.slotId) || value.event.workout || value.event.kind === "training")) throw new Error("Choose valid scheduled event details.");
  if (value.event) await assertWorkoutLinks(owner, [{ id: "day", day: "Monday", tasks: [current] }], [{ id: "day", day: "Monday", tasks: [value.event as EventItem] }]);
  const event: EventItem | null = value.event ? { ...individualEvent(value.event as EventItem), completedAt: value.event.completed ? current.completed ? current.completedAt ?? null : value.event.completedAt ?? new Date().toISOString() : null } : null;
  if (slotsReady) {
    const template = scheduledItem(schedule, ref.originalDate, undefined, ref.slotId);
    const comparable = (e: EventItem) => { const v = individualEvent(e); delete v.completedAt; return v; };
    const restore = !!event && !event.completed && value.date === ref.originalDate && !!template && same(comparable(event), comparable(template));
    return (await accountSql`SELECT b1_write_event_schedule_v2(${owner},${value.operationId}::uuid,${hash},${ref.scheduleId}::uuid,${ref.revision},${JSON.stringify(event)}::jsonb,${ref.originalDate}::date,${value.date}::date,${ref.scheduleRevision},${ref.slotId ?? "main"},${restore}) AS data`)[0].data as ScheduledOccurrence;
  }
  return (await accountSql`SELECT b1_write_event_schedule(${owner},${value.operationId}::uuid,${hash},${ref.scheduleId}::uuid,${ref.revision},${JSON.stringify(event)}::jsonb,${ref.originalDate}::date,${value.date}::date,${ref.scheduleRevision}) AS data`)[0].data as ScheduledOccurrence;
}
