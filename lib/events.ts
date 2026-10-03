import z from "zod";
import type { EventItem, EventItems } from "@/types/types";
import type { GymData, PlanRecord, SessionRecord } from "./gym/types";
import { addCalendarDays, weekDates, weekStart } from "./gym/dates";
import { blueprintSchema } from "./gym/validation";
import { timingSchema, type EventTiming } from "./planner-time";
export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function weekKey(date: string) {
  const monday = weekStart(date),
    thursday = new Date(`${addCalendarDays(monday, 3)}T12:00:00Z`),
    year = thursday.getUTCFullYear();
  const first = weekStart(`${year}-01-04`);
  return `${year}-WK${1 + Math.round((Date.parse(`${monday}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 604800000)}`;
}
export function weekDate(key: string) {
  const match = /^(\d{4})-WK(\d{1,2})$/.exec(key);
  if (!match) throw new Error("Choose a valid week");
  const date = addCalendarDays(weekStart(`${match[1]}-01-04`), (Number(match[2]) - 1) * 7);
  if (weekKey(date) !== key.replace(/WK0+/, "WK")) throw new Error("Choose a valid week");
  return date;
}
export const weekSchema = z.string().refine(value => {
  try {
    weekDate(value);
    return true;
  } catch {
    return false;
  }
}, "Choose a valid week");
export const eventSchema = z.object({
  id: z.string().min(1).max(150),
  title: z.string().trim().min(1).max(500),
  completed: z.boolean(),
  completedAt: z.iso.datetime().nullable().optional(),
  notes: z.string().max(3000).optional(),
  category: z.string().max(80).optional(),
  icon: z.enum(["calendar", "book", "work", "coffee", "workout"]).optional(),
  tone: z.enum(["blue", "orange"]).optional(),
  timing: timingSchema.optional(),
  order: z.number().finite().optional(),
  kind: z.enum(["manual", "training"]).optional(),
  workout: blueprintSchema.optional()
}).passthrough();
export const boardSchema = z.array(z.object({
  id: z.string().min(1).max(150),
  day: z.enum(weekdays as [string, ...string[]]),
  tasks: z.array(eventSchema).max(150)
}).passthrough()).max(7).superRefine((board, ctx) => {
  const ids = board.flatMap(day => day.tasks.map(item => item.id));
  if (new Set(ids).size !== ids.length || new Set(board.map(day => day.day)).size !== board.length) ctx.addIssue({
    code: "custom",
    message: "Event identifiers and days must be unique"
  });
});
export type PlannerItem = {
  id: string;
  date: string;
  title: string;
  completed: boolean;
  timing?: EventTiming;
  order: number;
  manual?: EventItem;
  plan?: PlanRecord;
  session?: SessionRecord;
};
export function plannerItems(board: EventItems[], gym: GymData, selected: string, startsOn:"monday"|"sunday"="monday"): PlannerItem[] {
  const days = weekDates(selected,startsOn),
    linked = new Set(gym.sessions.map(session => session.planId));
  const manual: PlannerItem[] = board.flatMap(day => day.tasks.map((item, index) => ({
    id: item.id,
    date: days.find(date=>((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7)===weekdays.indexOf(day.day))!,
    title: item.title,
    completed: item.completed,
    timing: item.timing,
    order: item.order ?? index * 1024,
    manual: item
  }))).filter(item => item.date);
  const plans: PlannerItem[] = gym.plans.filter(plan => days.includes(plan.date) && !linked.has(plan.id)).map((plan, index) => ({
    id: `plan:${plan.id}`,
    date: plan.date,
    title: plan.data.name,
    completed: false,
    timing: plan.data.timing,
    order: plan.data.timing?.order ?? index * 1024 + 512,
    plan
  }));
  const sessions: PlannerItem[] = gym.sessions.filter(session => days.includes(session.data.date)).map(session => ({
    id: `session:${session.id}`,
    date: session.data.date,
    title: session.data.name,
    completed: session.data.status === "completed",
    order: Number.MAX_SAFE_INTEGER,
    timing: gym.plans.find(plan => plan.id === session.planId)?.data.timing,
    session,
    plan: gym.plans.find(plan => plan.id === session.planId)
  }));
  return [...manual, ...plans, ...sessions].sort((a, b) => a.date.localeCompare(b.date) || comparePlannerItems(a, b));
}
export function comparePlannerItems(a: PlannerItem, b: PlannerItem) {
  if (a.timing?.start && b.timing?.start) return a.timing.start.localeCompare(b.timing.start) || a.order - b.order;
  if (a.timing?.start) return -1;
  if (b.timing?.start) return 1;
  return a.order - b.order || a.id.localeCompare(b.id);
}
export function placeManual(board: EventItems[], event: EventItem, date: string) {
  const day = weekdays[new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 6 : new Date(`${date}T12:00:00Z`).getUTCDay() - 1];
  const next = board.map(container => ({
    ...container,
    tasks: container.tasks.filter(item => item.id !== event.id)
  }));
  const target = next.find(container => container.day === day);
  if (target) target.tasks.push(event);else next.push({
    id: day.toLowerCase(),
    day,
    tasks: [event]
  });
  return next;
}
export function destinationOrder(items: PlannerItem[], target: string, moving: string, insertAfter = false) {
  const candidates = items.filter(item => item.id !== moving && !item.timing?.start && !item.session);
  let index = candidates.findIndex(item => item.id === target);
  if (index < 0) return (candidates.at(-1)?.order ?? -1024) + 1024;
  if (insertAfter) index += 1;
  if (index === candidates.length) return candidates.at(-1)!.order + 1024;
  const after = candidates[index].order,
    before = candidates[index - 1]?.order ?? after - 2048;
  return before + (after - before) / 2;
}
export function resetPreset(board: EventItems[], idFor: (id: string) => string): EventItems[] {
  return board.map(day => ({
    ...day,
    tasks: day.tasks.map(item => ({
      ...item,
      id: idFor(item.id),
      completed: false,
      completedAt: null
    }))
  }));
}
