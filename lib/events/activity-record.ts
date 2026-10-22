import "server-only";
import { accountSql } from "../account/store";
import { weekKey } from "../events";
import { activityFeed } from "./activity-feed";
import { projectedWorkoutPlans } from "./scheduled-workouts";
import { readScheduledOccurrences } from "./schedule-store";
import type { EventItem, EventItems } from "@/types/types";
import type { GymData, PlanRecord, SessionRecord } from "../gym/types";
import type { Occurrence } from "./activity-types";

export type ActivityRecord = { occurrence: Occurrence; event?: EventItem; plan?: PlanRecord; session?: SessionRecord };

/** Read one acknowledged activity, without loading unrelated account sections. */
export async function readActivityRecord(owner: string, id: string, date: string): Promise<ActivityRecord> {
  const empty: GymData = { plans: [], sessions: [], templates: [], customExercises: [], restDays: [] };
  if (id.startsWith("event:scheduled:")) {
    const row = (await readScheduledOccurrences(owner, date, date)).find(row => `event:${row.event.id}` === id);
    if (!row) throw new Error("This activity moved or was removed. Reload its current date.");
    const { event } = row, ref = event.scheduled!;
    return { event, occurrence: { id, version: `${ref.scheduleRevision}:${ref.revision}`, locator: event.id, date: row.date, completedDate: event.completed ? row.date : null, completedAt: event.completedAt ?? null, completed: event.completed, title: event.title, category: event.category ?? "", workout: false, seriesId: ref.scheduleId, routineId: null, timing: event.timing, href: `/account/events?date=${row.date}` } };
  }
  if (id.startsWith("event:")) {
    const week = weekKey(date);
    const rows = await accountSql`SELECT data FROM user_events WHERE user_id=${owner} AND week=${week}`;
    const board = (rows[0]?.data ?? []) as EventItems[];
    const occurrence = activityFeed([{ week, data: board }], empty, "UTC").find(row => row.id === id);
    const event = board.flatMap(day => day.tasks).find(event => `event:${event.id}` === id);
    if (!occurrence || !event) throw new Error("This activity moved or was removed. Reload its current date.");
    return { occurrence, event };
  }
  const match = /^workout:(plan|session):([a-zA-Z0-9-]+)$/.exec(id);
  if (!match) throw new Error("Choose a supported activity.");
  const sessions = match[1] === "plan"
    ? await accountSql`SELECT id,data,plan_id,revision FROM gym_sessions WHERE user_id=${owner} AND plan_id=${match[2]} AND NOT archived`
    : await accountSql`SELECT id,data,plan_id,revision FROM gym_sessions WHERE user_id=${owner} AND id=${match[2]} AND NOT archived`;
  const row = sessions[0], planId = match[1] === "plan" ? match[2] : row?.plan_id;
  const plans = planId ? await accountSql`SELECT id,data,date::text,timezone,revision FROM gym_plans WHERE user_id=${owner} AND id=${planId} AND NOT archived` : [];
  const plan = (plans[0] ?? (planId ? (await projectedWorkoutPlans(owner, date, date)).find(p => p.id === planId) : undefined)) as PlanRecord | undefined;
  const session: SessionRecord | undefined = row ? { id: row.id, data: row.data, revision: row.revision, planId: row.plan_id } : undefined;
  const occurrence = activityFeed([], { ...empty, plans: plan ? [plan] : [], sessions: session ? [session] : [] }, "UTC")[0];
  if (!occurrence) throw new Error("This activity moved or was removed. Reload its current date.");
  return { occurrence, plan, session };
}
