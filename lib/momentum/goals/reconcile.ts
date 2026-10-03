import { addCalendarDays, dateInZone } from "../../gym/dates";
import type { Activity, MomentumData, Sources } from "../types";
import { evaluateGoal, goalWindow, nextMonth, trackerFor } from "./evaluate";
export function reconcileGoals(data: MomentumData, sources: Sources & { activities: Activity[] }, now: string) {
  if (!data.tracker?.goals.length) return data;
  const tracker = structuredClone(trackerFor(data));
  const working = { ...data, tracker };
  for (const goal of tracker.goals) {
    const first = goal.versions[0].rule, today = dateInZone(new Date(now), first.timezone), dates = new Set(tracker.history.filter(x => x.goalId === goal.id).map(x => x.start));
    // Preserve existing periods; backfill a bounded, useful history rather than creating fabricated commitments before the chosen start.
    let cursor = first.start; for (let i = 0; i < 120 && cursor <= today && (!first.end || cursor <= first.end); i++) { dates.add(cursor); const window = goalWindow(first, cursor); if (!["weekly", "monthly"].includes(first.period)) break; cursor = first.period === "monthly" ? nextMonth(cursor) : addCalendarDays(window.end!, 1); }
    dates.add(today);
    for (const date of dates) {
      const evaluation = evaluateGoal(goal, working, sources, now, date), index = tracker.history.findIndex(x => x.goalId === goal.id && x.key === evaluation.period.key), old = tracker.history[index];
      if (!old || old.signature !== evaluation.signature || old.status !== evaluation.status) { const value = { goalId: goal.id, key: evaluation.period.key, start: evaluation.period.start, end: evaluation.period.end, version: evaluation.version, value: evaluation.value, status: evaluation.status, signature: evaluation.signature, evaluatedAt: now, revisedAt: old && old.signature !== evaluation.signature ? now : old?.revisedAt ?? null }; if (old) tracker.history[index] = value; else tracker.history.push(value); }
      const key = `${goal.id}:${evaluation.period.key}`;
      if (goal.lifecycle === "active" && evaluation.met && evaluation.rule.metric !== "balance" && !tracker.attainments.some(x => x.key === key)) tracker.attainments.push({ key, at: now });
    }
  }
  return working;
}
