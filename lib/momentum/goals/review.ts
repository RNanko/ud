import { addCalendarDays, dateInZone } from "../../gym/dates";
import type { Activity, MomentumData, Sources } from "../types";
import { evaluateGoal, trackerFor } from "./evaluate";
export function goalReview(data: MomentumData, sources: Sources & { activities: Activity[] }, week: string, timezone: string, now: string) {
  const today = dateInZone(new Date(now), timezone), anchor = Array.from({length:7},(_,index)=>addCalendarDays(week,index)).includes(today) ? today : addCalendarDays(week, 6);
  return trackerFor(data).goals.filter(goal => goal.lifecycle !== "archived" && (data.preferences.money || !["balance", "savings", "investment"].includes(goal.versions.at(-1)!.rule.metric))).map(goal => { const value = evaluateGoal(goal, data, sources, now, anchor); return { goalId: goal.id, period: value.period.label, metric: value.rule.metric, value: value.value, target: value.rule.target, currency: value.rule.currency, status: value.status, asOf: value.asOf, version: value.version, revised: value.revised }; });
}
