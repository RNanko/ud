import type { EventItems } from "@/types/types";
import type { GymData } from "../gym/types";
import type { Occurrence } from "./activity-types";
import { addCalendarDays } from "../calendar";
import { weekDate, weekdays } from "../events";

/** Events owns this projection: consumers never count a separate Gym feed again. */
export function activityFeed(weeks: { week: string; data: EventItems[] }[], gym: GymData, timezone: string): Occurrence[] {
  void timezone;
  const result: Occurrence[] = [];
  for (const row of weeks) {
    let start: string;
    try { start = weekDate(row.week); } catch { continue; }
    for (const day of row.data) for (const event of day.tasks) {
      if (event.kind === "training" || event.workout) continue;
      const date = addCalendarDays(start, weekdays.indexOf(day.day));
      result.push({ id: `event:${event.id}`, version: JSON.stringify(event), locator: event.id, timing: event.timing, date, completedDate: event.completed ? date : null, completedAt: event.completedAt ?? null, completed: event.completed, title: event.title, category: event.category ?? "", workout: false, seriesId: event.scheduled?.scheduleId ?? (typeof event.momentumSeriesId === "string" ? event.momentumSeriesId : null), routineId: null, href: `/account/events?week=${row.week}&event=${encodeURIComponent(event.id)}` });
    }
  }
  const seen = new Set<string>();
  for (const session of gym.sessions) {
    const id = session.planId ? `workout:plan:${session.planId}` : `workout:session:${session.id}`;
    const plan = gym.plans.find(p => p.id === session.planId);
    const meta = plan?.data ?? session.data.originalPlan;
    const date = plan?.date ?? session.data.date;
    result.push({ id, version: `${plan?.revision ?? "none"}:${session.revision}`, locator: `session:${session.id}`, timing: meta?.timing, date, completedDate: session.data.status === "completed" ? date : null, completedAt: session.data.finishedAt ?? null, completed: session.data.status === "completed", title: session.data.name, category: "Workout", workout: true, seriesId: meta?.scheduled?.scheduleId ?? meta?.momentumSeriesId ?? null, routineId: meta?.routineId ?? null, href: `/account/gym?session=${session.id}` }); seen.add(id);
  }
  for (const plan of gym.plans) {
    const id = `workout:plan:${plan.id}`;
    if (seen.has(id)) continue;
    result.push({ id, version: plan.revision === -1 && plan.data.scheduled ? `virtual:${plan.data.scheduled.scheduleRevision}:${plan.data.scheduled.revision}` : `${plan.revision}:none`, locator: `plan:${plan.id}`, timing: plan.data.timing, date: plan.date, completedDate: null, completedAt: null, completed: false, title: plan.data.name, category: "Workout", workout: true, seriesId: plan.data.scheduled?.scheduleId ?? plan.data.momentumSeriesId ?? null, routineId: plan.data.routineId ?? null, href: `/account/gym?date=${plan.date}&plan=${plan.id}` });
  }
  return [...new Map(result.map(e => [e.id, e])).values()];
}
