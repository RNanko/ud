import "server-only";
import { accountSettings, accountSql, membershipFor } from "./store";
import { PERSONAL_PRODUCT } from "./config";
import { quietNow } from "./preferences";
import { dateInZone, weekStart, addCalendarDays } from "../gym/dates";
import { sourceActivities } from "../momentum/logic";
import { evaluateGoal, reminderDue, trackerFor } from "../momentum/goals/evaluate";
import { emptyMomentum, type MomentumData, type Sources } from "../momentum/types";
import { emptyTodoBoard } from "../todo";
import { plannerItems } from "../events";

export type Notification = { key: string; title: string; href: string };
export async function dueNotifications(owner: string, now = new Date()): Promise<Notification[]> {
  const { preferences: p, notifications: n } = await accountSettings(owner);
  if (quietNow(n, now, p.timezone)) return [];
  const deleted = await accountSql`SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  if (deleted[0]) return [];
  const today = dateInZone(now, p.timezone), clock = new Intl.DateTimeFormat("en-GB", { timeZone: p.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const [todos, plans, sessions, rests, weeks, states, membership] = await Promise.all([
    accountSql`SELECT data FROM kanban_board WHERE user_id=${owner}`,
    accountSql`SELECT id,data,date,timezone,revision FROM gym_plans WHERE user_id=${owner} AND archived=false`,
    accountSql`SELECT id,data,plan_id,revision FROM gym_sessions WHERE user_id=${owner} AND archived=false`,
    accountSql`SELECT date FROM gym_rest_days WHERE user_id=${owner} AND rest=true`,
    accountSql`SELECT week,data FROM user_events WHERE user_id=${owner}`,
    accountSql`SELECT data FROM momentum_state WHERE user_id=${owner}`, membershipFor(owner),
  ]);
  const data: MomentumData = states[0]?.data ?? emptyMomentum();
  const sources: Sources = { todo: todos[0]?.data ?? emptyTodoBoard(), weeks: weeks.filter(row => /^\d{4}-WK\d{1,2}$/.test(row.week)).map(row => ({ week: row.week, data: row.data })), gym: { templates: [], customExercises: [], plans: plans.map(row => ({ id: row.id, data: row.data, revision: row.revision, timezone: row.timezone, date: String(row.date).slice(0, 10) })), sessions: sessions.map(row => ({ id: row.id, data: row.data, revision: row.revision, planId: row.plan_id })), restDays: rests.map(row => String(row.date).slice(0, 10)) } };
  const due: Notification[] = [];
  if (n.eventReminders) for (const week of sources.weeks) {
    // Canonical ISO storage is Monday based, independent of the visible week preference.
    const { weekDate } = await import("../events");
    for (const event of plannerItems(week.data, { ...sources.gym, plans: [], sessions: [] }, weekDate(week.week))) {
      if (event.completed || event.date !== today) continue;
      const start = event.timing?.start;
      const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      if (start ? minute(start) - minute(clock) < 0 || minute(start) - minute(clock) > 60 : clock < "09:00" || clock > "12:00") continue;
      due.push({ key: `event:${event.id}:${event.date}:${start ?? "any"}`, title: "An unfinished event is coming up", href: "/account/events" });
    }
  }
  if (n.goalReminders) {
    const tracker = trackerFor(data), activities = sourceActivities(sources, p.timezone);
    for (const goal of tracker.goals) {
      const evaluation = evaluateGoal(goal, data, { ...sources, activities }, now.toISOString());
      const key = reminderDue(goal, evaluation, tracker, now.toISOString());
      if (key) due.push({ key: `goal:${key}`, title: "A recorded goal is ready for your next step", href: "/account/momentum" });
    }
  }
  const week = weekStart(today, p.weekStart);
  if (n.weeklyReview && today === addCalendarDays(week, 6) && clock >= "18:00" && !data.reviews.some(review => review.week === week && !review.draft)) due.push({ key: `review:${week}`, title: "Review what moved forward this week", href: "/account/momentum?view=review" });
  if (n.trialReminder && membership?.trial_ends_at && !membership.paid_confirmed) {
    const remaining = Date.parse(membership.trial_ends_at) - now.getTime();
    if (remaining > 0 && remaining <= 48 * 3600000) due.push({ key: `trial:${new Date(membership.trial_ends_at).toISOString()}`, title: "Your trial ends soon. Your records will remain readable", href: "/account?section=membership" });
  }
  return due;
}

export async function queueOptionalNotifications() {
  // Product reminders are internal only, including for legacy email opt-ins.
  // Keep the job's interface while preventing any new reminder-mail outbox writes.
  return 0;
}
