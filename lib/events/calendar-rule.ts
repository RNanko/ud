import { z } from "zod";
import { calendarDay } from "../gym/validation";
import { addCalendarDays } from "../calendar";

const dayMs = 86400000;
export const weekdayIndex = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
export const calendarRuleSchema = z.object({
  start: calendarDay,
  end: calendarDay.nullable(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  intervalWeeks: z.number().int().min(1).max(52).optional(),
  count: z.number().int().min(1).max(1000000).nullable().optional(),
}).superRefine((rule, ctx) => {
  if (rule.end && rule.end < rule.start || new Set(rule.days).size !== rule.days.length)
    ctx.addIssue({ code: "custom", message: "Choose a valid date range and different weekdays." });
});
export type CalendarRule = z.infer<typeof calendarRuleSchema>;

/** Number of eligible days strictly before date. Work is bounded by seven weekdays,
 * independent of how many years have elapsed since the rule began. */
export function daysBefore(rule: CalendarRule, date: string) {
  const last = Math.floor((Date.parse(date) - Date.parse(rule.start)) / dayMs) - 1;
  if (last < 0) return 0;
  const interval = rule.intervalWeeks ?? 1;
  const startDay = weekdayIndex(rule.start);
  let total = 0;
  for (const weekday of rule.days) {
    let first = weekday - startDay;
    if (first < 0) first += interval * 7;
    if (first <= last) total += Math.floor((last - first) / (interval * 7)) + 1;
  }
  return total;
}

export function ruleHasDate(rule: CalendarRule, date: string) {
  if (date < rule.start || rule.end && date > rule.end || !rule.days.includes(weekdayIndex(date))) return false;
  const delta = Math.floor((Date.parse(date) - Date.parse(rule.start)) / dayMs);
  return Math.floor((delta + weekdayIndex(rule.start)) / 7) % (rule.intervalWeeks ?? 1) === 0;
}

/** Pure visible-window expansion, shared by event and workout schedule consumers. */
export function calendarSlots(rule: CalendarRule, slotIds: string[], from: string, to: string) {
  calendarDay.parse(from); calendarDay.parse(to);
  const span = (Date.parse(to) - Date.parse(from)) / dayMs;
  if (span < 0 || span > 3660) throw new Error("Choose a smaller event date range.");
  const result: { date: string; slotId: string }[] = [];
  const end = rule.end && rule.end < to ? rule.end : to;
  for (let date = from > rule.start ? from : rule.start; date <= end; date = addCalendarDays(date, 1)) {
    if (!ruleHasDate(rule, date)) continue;
    const offset = daysBefore(rule, date) * slotIds.length;
    for (let index = 0; index < slotIds.length; index++) {
      if (rule.count != null && offset + index >= rule.count) break;
      result.push({ date, slotId: slotIds[index] });
    }
  }
  return result;
}
