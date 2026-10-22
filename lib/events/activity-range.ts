import "server-only";
import { z } from "zod";
import { accountSql } from "../account/store";
import { weekKey } from "../events";
import { addCalendarDays } from "../calendar";
import { calendarDay, timezoneSchema } from "../gym/validation";
import { readEventSchedules } from "./schedule-store";
import { projectScheduledEvents, type ScheduledOccurrence } from "./recurrence";
import { scheduledWorkoutId } from "./scheduled-workouts";
import { activityFeed } from "./activity-feed";
import type { EventItems } from "@/types/types";
import type { PlanRecord, SessionData } from "../gym/types";
import type { Occurrence } from "./activity-types";

/** Bounded, owner-scoped scheduling preview. Reads never create future records. */
export async function readCanonicalActivityRange(owner: string, input: { from: string; to: string }, timezone: string): Promise<Occurrence[]> {
  z.string().min(1).max(200).parse(owner);
  const range = z.object({ from: calendarDay, to: calendarDay }).strict().parse(input);
  timezoneSchema.parse(timezone);
  const span = (Date.parse(range.to) - Date.parse(range.from)) / 86400000;
  if (span < 0 || span > 366) throw new Error("Choose an ordered activity range of at most one year.");
  const weeks = new Set<string>();
  for (let day = range.from; day <= range.to; day = addCalendarDays(day, 1)) weeks.add(weekKey(day));
  const [boards, plans, sessions, schedules] = await Promise.all([
    accountSql`SELECT week,data FROM user_events WHERE user_id=${owner} AND week=ANY(${[...weeks]}::text[]) LIMIT 55`,
    accountSql`SELECT id,date::text,timezone,data,revision FROM gym_plans WHERE user_id=${owner} AND NOT archived AND date BETWEEN ${range.from}::date AND ${range.to}::date LIMIT 10001`,
    accountSql`SELECT s.id,s.plan_id,s.data,s.revision FROM gym_sessions s LEFT JOIN gym_plans p ON p.id=s.plan_id AND p.user_id=s.user_id
      WHERE s.user_id=${owner} AND NOT s.archived AND (p.id IS NULL OR NOT p.archived)
      AND COALESCE(p.date::text,s.data->>'date') BETWEEN ${range.from} AND ${range.to} LIMIT 10001`,
    readEventSchedules(owner),
  ]);
  if (boards.length > 54 || plans.length > 10000 || sessions.length > 10000) throw new Error("Choose a smaller activity range.");
  const exceptions = schedules.length ? await accountSql`SELECT data FROM b1_event_occurrences WHERE user_id=${owner}
    AND (date BETWEEN ${range.from}::date AND ${range.to}::date OR original_date BETWEEN ${range.from}::date AND ${range.to}::date) LIMIT 10001` : [];
  if (exceptions.length > 10000) throw new Error("Choose a smaller activity range.");
  const projected = projectScheduledEvents(schedules, exceptions.map(row => row.data as ScheduledOccurrence), range.from, range.to);
  const ids = projected.filter(row => row.event.workout).map(row => scheduledWorkoutId(row.event.scheduled!));
  // A saved plan moved outside this window still suppresses its old virtual slot.
  const mappings = ids.length ? await accountSql`SELECT plan_id FROM b1_scheduled_workouts WHERE user_id=${owner} AND plan_id=ANY(${ids}::text[]) LIMIT 10001` : [];
  const materialized = new Set(mappings.map(row => row.plan_id));
  const savedPlans = plans as PlanRecord[];
  const virtualPlans: PlanRecord[] = projected.filter(row => row.event.workout && !materialized.has(scheduledWorkoutId(row.event.scheduled!))).map(({ date, event }) => ({
    id: scheduledWorkoutId(event.scheduled!), date, timezone: event.scheduled!.timezone, revision: -1,
    data: { ...event.workout!, name: event.title, timing: event.timing, scheduled: event.scheduled },
  }));
  const projectedEvents: Occurrence[] = projected.filter(row => !row.event.workout).map(({ date, event }) => ({
    id: `event:${event.id}`, version: `${event.scheduled!.scheduleRevision}:${event.scheduled!.revision}`, locator: event.id,
    date, completedDate: event.completed ? date : null, completedAt: event.completedAt ?? null, completed: event.completed,
    title: event.title, category: event.category ?? "", workout: false, seriesId: event.scheduled!.scheduleId,
    routineId: null, timing: event.timing, href: `/account/events?date=${date}`,
  }));
  const facts = activityFeed(boards as { week: string; data: EventItems[] }[], {
    plans: [...savedPlans, ...virtualPlans],
    sessions: sessions.map(row => ({ id: row.id as string, planId: row.plan_id as string | null, data: row.data as SessionData, revision: row.revision as number })),
    templates: [], customExercises: [], restDays: [],
  }, timezone);
  return [...new Map([...projectedEvents, ...facts].map(row => [row.id, row])).values()].filter(row => row.date >= range.from && row.date <= range.to);
}
