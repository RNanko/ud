import { z } from "zod";
import { eventSchema, weekdays } from "../events";
import { addCalendarDays } from "../calendar";
import { calendarDay, timezoneSchema } from "../gym/validation";
import { calendarRuleSchema, calendarSlots, daysBefore, ruleHasDate, weekdayIndex } from "./calendar-rule";
import { timingSchema } from "../planner-time";
import type { EventItem, EventItems } from "@/types/types";

const slotSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/), timing: timingSchema }).strict();
const versionSchema = z.object({
  effectiveFrom: calendarDay, event: eventSchema,
  ...calendarRuleSchema.shape,
  slots: z.array(slotSchema).min(1).max(12).optional(),
}).strict();
export const eventScheduleSchema = z.object({
  id: z.uuid(), revision: z.number().int().min(-1),
  event: eventSchema, start: calendarDay, end: calendarDay.nullable(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timezone: timezoneSchema, stoppedFrom: calendarDay.nullable(),
  intervalWeeks: calendarRuleSchema.shape.intervalWeeks,
  count: calendarRuleSchema.shape.count,
  slots: z.array(slotSchema).min(1).max(12).optional(),
  versions: z.array(versionSchema).max(120).optional(),
  ownerGoalId: z.string().min(1).max(200).nullable().optional(),
  // Saved schedule metadata remains readable without its former goal feature.
  ownerGoalDomain: z.string().min(1).max(200).optional(),
  ownerActionId: z.string().min(1).max(200).nullable().optional(),
}).strict().superRefine((s, ctx) => {
  if (s.end && s.end < s.start || new Set(s.days).size !== s.days.length)
    ctx.addIssue({ code: "custom", message: "Choose a valid date range and different weekdays." });
  if (s.event.workoutLink || s.event.kind === "training" && !s.event.workout)
    ctx.addIssue({ code: "custom", message: "Choose a workout template for a training schedule." });
  const rules = [s, ...(s.versions ?? [])];
  for (const rule of rules) {
    if (!calendarRuleSchema.safeParse(rule).success || rule.slots && new Set(rule.slots.map(slot => slot.id)).size !== rule.slots.length)
      ctx.addIssue({ code: "custom", message: "Choose valid recurrence days and unique time slots." });
    if (rule.event.workoutLink || rule.event.kind === "training" && !rule.event.workout)
      ctx.addIssue({ code: "custom", message: "Choose a workout template for a training schedule." });
  }
  if (s.versions?.some((v, i) => v.effectiveFrom < s.start || i > 0 && v.effectiveFrom <= s.versions![i - 1].effectiveFrom))
    ctx.addIssue({ code: "custom", message: "Schedule versions must be in date order." });
});
export type EventSchedule = z.infer<typeof eventScheduleSchema>;
export type ScheduledOccurrence = { scheduleId: string; originalDate: string; slotId?: string; date: string; event?: EventItem | null; revision: number };
export type ScheduleRef = { scheduleId: string; originalDate: string; slotId?: string; revision: number; scheduleRevision: number; timezone: string };
export const occurrenceKey = (id: string, date: string, slotId = "main") => `scheduled:${id}:${date}${slotId === "main" ? "" : `:${slotId}`}`;
export { weekdayIndex };
export function scheduleRule(s: EventSchedule, date: string) {
  return [...(s.versions ?? [])].reverse().find(v => v.effectiveFrom <= date) ?? s;
}
export function isScheduledOn(s: EventSchedule, date: string, slotId = "main") {
  const rule = scheduleRule(s, date), slots = rule.slots?.map(slot => slot.id) ?? ["main"], index = slots.indexOf(slotId);
  return index >= 0 && (!s.stoppedFrom || date < s.stoppedFrom) && ruleHasDate(rule, date)
    && (rule.count == null || daysBefore(rule, date) * slots.length + index < rule.count);
}
export function individualEvent(event: EventItem): EventItem {
  const plain = { ...event };
  delete plain.scheduled;
  delete plain.momentumSeriesId;
  return plain;
}
export function scheduledItem(s: EventSchedule, date: string, override?: ScheduledOccurrence, slotId = override?.slotId ?? "main"): EventItem | null {
  if (override?.event === null) return null;
  if (!override?.event && !isScheduledOn(s, date, slotId)) return null;
  const rule = scheduleRule(s, date), timing = rule.slots?.find(slot => slot.id === slotId)?.timing;
  const template = { ...rule.event, ...(timing ? { timing } : {}) };
  return { ...individualEvent(override?.event ?? template), id: occurrenceKey(s.id, date, slotId),
    scheduled: { scheduleId: s.id, originalDate: date, ...(slotId !== "main" ? { slotId } : {}), revision: override?.revision ?? -1, scheduleRevision: s.revision, timezone: s.timezone } };
}
/** Pure, bounded projection. No inserts are needed to view a future week. */
export function projectScheduledEvents(schedules: EventSchedule[], overrides: ScheduledOccurrence[], from: string, to: string) {
  calendarDay.parse(from); calendarDay.parse(to);
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (span < 0 || span > 3660) throw new Error("Choose a smaller event date range.");
  const result: { date: string; event: EventItem }[] = [];
  const bySlot = new Map(overrides.map(o => [occurrenceKey(o.scheduleId, o.originalDate, o.slotId), o]));
  for (const s of schedules) {
    const versions = [{ effectiveFrom: s.start, rule: s }, ...(s.versions ?? []).map(rule => ({ effectiveFrom: rule.effectiveFrom, rule }))];
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i], next = versions[i + 1]?.effectiveFrom;
      const start = version.effectiveFrom > from ? version.effectiveFrom : from;
      let end = next && next <= to ? addCalendarDays(next, -1) : to;
      if (s.stoppedFrom && s.stoppedFrom <= end) end = addCalendarDays(s.stoppedFrom, -1);
      if (start > end) continue;
      for (const { date, slotId } of calendarSlots(version.rule, version.rule.slots?.map(slot => slot.id) ?? ["main"], start, end)) {
        if (bySlot.has(occurrenceKey(s.id, date, slotId))) continue;
        const event = scheduledItem(s, date, undefined, slotId);
        if (event) result.push({ date, event });
      }
    }
  }
  for (const o of overrides) {
    if (o.date < from || o.date > to) continue;
    const s = schedules.find(s => s.id === o.scheduleId);
    const event = s && scheduledItem(s, o.originalDate, o);
    if (event) result.push({ date: o.date, event });
  }
  return result;
}
export function mergeScheduledBoard(board: EventItems[], dates: string[], occurrences: { date: string; event: EventItem }[]): EventItems[] {
  const result = board.map(day => ({ ...day, tasks: day.tasks.filter(e => !e.scheduled) }));
  for (const { date, event } of occurrences.filter(o => dates.includes(o.date))) {
    const name = weekdays[weekdayIndex(date)];
    let day = result.find(d => d.day === name);
    if (!day) { day = { id: name.toLowerCase(), day: name, tasks: [] }; result.push(day); }
    day.tasks.push(event);
  }
  return result;
}
export function withoutScheduled(board: EventItems[]): EventItems[] {
  return board.map(day => ({ ...day, tasks: day.tasks.filter(e => !e.scheduled) }));
}
/** Ordinary board saves must never persist a projected future schedule. */
export function assertUnchangedSchedules(before: EventItems[], after: EventItems[]) {
  const select = (board: EventItems[]) => board.flatMap(day => day.tasks.filter(e => e.scheduled).map(event => ({ day: day.day, event }))).sort((a, b) => a.event.id.localeCompare(b.event.id));
  if (JSON.stringify(select(before)) !== JSON.stringify(select(after))) throw new Error("Scheduled events must be updated individually. Reload and retry.");
}
