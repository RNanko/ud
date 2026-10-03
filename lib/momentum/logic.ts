import { addCalendarDays, dateInZone } from "../gym/dates";
import { sessionSummary } from "../gym/logic";
import { weekDate, weekdays } from "../events";
import type { Activity, Chapter, Currency, Focus, MomentumData, SourceRef, Sources, Summary } from "./types";
import { thoughts } from "./content";

export function sourceKey(ref: SourceRef) { return `${ref.kind}:${ref.week ? `${ref.week}:` : ""}${ref.id}`; }
export function sourceActivities(sources: Sources, timezone: string): Activity[] {
  const tasks: Activity[] = sources.todo.flatMap(group => group.items.map(task => ({ ref: { kind: "task" as const, id: task.id }, key: `task:${task.id}`, title: task.content, status: group.id === "done" ? "completed" as const : group.id === "in-progress" ? "active" as const : "planned" as const, date: task.completedAt ? dateInZone(new Date(task.completedAt), timezone) : task.dueDate ?? null, completedAt: task.completedAt ?? null, href: `/account/to-do?task=${encodeURIComponent(task.id)}`, detail: `To-Do · ${group.title}`, minutes: null })));
  const workouts: Activity[] = sources.gym.plans.map(plan => {
    const session = sources.gym.sessions.find(session => session.planId === plan.id);
    return { ref: { kind: "workout", id: plan.id }, key: `workout:${plan.id}`, title: session?.data.name ?? plan.data.name, status: session?.data.status ?? "planned", date: session?.data.date ?? plan.date, completedAt: session?.data.finishedAt ?? null, href: session ? `/account/gym?session=${session.id}` : `/account/gym?date=${plan.date}&plan=${plan.id}`, detail: session?.data.status === "completed" ? session.data.completionMode === "confirmation" ? "Completed — no details logged" : "Completed workout · actual results" : session ? "Gym · active workout" : "Gym · planned workout", minutes: plan.data.estimatedMinutes, time: plan.data.timing?.start, timing: plan.data.timing };
  });
  for (const session of sources.gym.sessions.filter(session => !session.planId || !sources.gym.plans.some(plan => plan.id === session.planId))) {
    const id = session.planId ?? `session:${session.id}`;
    workouts.push({ ref: { kind: "workout", id }, key: `workout:${id}`, title: session.data.name, status: session.data.status, date: session.data.date, completedAt: session.data.finishedAt, href: `/account/gym?session=${session.id}`, detail: session.data.status === "completed" ? session.data.completionMode === "confirmation" ? "Completed — no details logged" : "Completed workout · actual results" : "Gym · active workout", minutes: null });
  }
  const events: Activity[] = sources.weeks.flatMap(row => {
    let start: string;
    try { start = weekDate(row.week); } catch { return []; }
    return row.data.flatMap(day => day.tasks.filter(item => item.kind !== "training" && !item.workout).map(item => {
      const scheduled = addCalendarDays(start, weekdays.indexOf(day.day));
      const ref: SourceRef = { kind: "event", id: item.id, week: row.week };
      return { ref, key: sourceKey(ref), title: item.title, status: item.completed ? "completed" as const : "planned" as const, date: item.completedAt ? dateInZone(new Date(item.completedAt), timezone) : scheduled, completedAt: item.completedAt ?? null, href: `/account/events?date=${scheduled}&event=${encodeURIComponent(item.id)}`, detail: item.completed ? item.completedAt ? "Events · confirmed completion" : "Events · confirmed; scheduled date only" : "Events · attendance not confirmed", minutes: null, time: item.timing?.start, timing: item.timing };
    }));
  });
  return [...new Map([...tasks, ...workouts, ...events].map(activity => [activity.key, activity])).values()];
}
export function chapterDone(chapter: Chapter, activities: Activity[]) {
  return chapter.links.length ? chapter.links.every(ref => activities.some(activity => activity.key === sourceKey(ref) && activity.status === "completed")) : !!chapter.confirmedAt;
}
export function suggestion(data: MomentumData, activities: Activity[], date: string, rest: boolean): { activity: Activity; reason: string; journeyId: string | null } | null {
  const available = activities.filter(activity => activity.status !== "completed" && (!activity.date || activity.date <= date) && !(rest && activity.ref.kind === "workout"));
  const active = available.find(activity => activity.status === "active");
  if (active) return { activity: active, reason: "Continue work you already started", journeyId: null };
  for (const journey of data.journeys.filter(journey => journey.status === "active" && journey.priority !== "later").sort((a, b) => a.priority === b.priority ? 0 : a.priority === "primary" ? -1 : 1)) {
    const next = journey.chapters.find(chapter => !chapterDone(chapter, activities));
    const activity = available.find(activity => next?.links.some(ref => sourceKey(ref) === activity.key));
    if (activity) return { activity, reason: `The next step in ${journey.title}`, journeyId: journey.id };
  }
  const activity = available.find(activity => activity.ref.kind === "task");
  return activity ? { activity, reason: "An existing task you can choose; nothing is added until you select it", journeyId: null } : null;
}
export function elapsedFocus(focus: Focus, now: number) {
  let seconds = 0;
  for (const interval of focus.intervals) {
    const remaining = Math.max(0, focus.plannedSeconds - seconds);
    seconds += Math.min(remaining, Math.max(0, (Date.parse(interval.end ?? new Date(now).toISOString()) - Date.parse(interval.start)) / 1000));
  }
  return Math.floor(seconds);
}
export function closeFocusInterval(focus: Focus, now: number): Focus {
  let elapsed = 0;
  return { ...focus, intervals: focus.intervals.map(interval => {
    const start = Date.parse(interval.start), cap = start + Math.max(0, focus.plannedSeconds - elapsed) * 1000;
    const end = Math.min(Date.parse(interval.end ?? new Date(now).toISOString()), now, cap);
    elapsed += Math.max(0, (end - start) / 1000);
    return { start: interval.start, end: interval.end ?? new Date(Math.max(start, end)).toISOString() };
  }) };
}
export function assignThought(data: MomentumData, date: string, ownerSeed: string) {
  if (data.thoughts.some(item => item.date === date)) return data;
  const recent = new Set(data.thoughts.filter(item => item.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, Math.min(7, thoughts.length - 1)).map(item => item.index));
  let hash = 0;
  for (const char of `${ownerSeed}:${date}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const eligible = thoughts.map((_, index) => index).filter(index => !recent.has(index));
  return { ...data, thoughts: [...data.thoughts, { date, index: eligible[hash % eligible.length], dismissed: false }].slice(-730) };
}
export function buildSummary(sources: Sources, activities: Activity[], data: MomentumData, week: string, timezone: string, now: string): Summary {
  const dates = Array.from({length:7},(_,index)=>addCalendarDays(week,index)), completed = activities.filter(item => item.status === "completed" && item.date && dates.includes(item.date));
  const sessions = sources.gym.sessions.filter(item => item.data.status === "completed" && dates.includes(item.data.date));
  const cardio: Summary["cardio"] = {};
  let strengthSets = 0;
  for (const session of sessions.filter(item => item.data.completionMode !== "confirmation")) {
    const summary = sessionSummary(session.data);
    strengthSets += summary.sets;
    for (const [type, entry] of Object.entries(summary.cardio)) {
      const current = cardio[type] ?? { seconds: 0, distanceKm: 0, knownDistances: 0 };
      cardio[type] = { seconds: current.seconds + entry.seconds, distanceKm: current.distanceKm + entry.distanceKm, knownDistances: current.knownDistances + entry.knownDistances };
    }
  }
  return { workouts: sessions.length, activeWorkouts: sources.gym.sessions.filter(item => item.data.status === "active" && dates.includes(item.data.date)).length, plannedWorkouts: activities.filter(item => item.ref.kind === "workout" && item.status === "planned" && !!item.date && dates.includes(item.date)).length, tasks: completed.filter(item => item.ref.kind === "task" && item.completedAt).length, undatedTasks: activities.filter(item => item.ref.kind === "task" && item.status === "completed" && !item.completedAt).length, events: completed.filter(item => item.ref.kind === "event").length, scheduledDateEvents: completed.filter(item => item.ref.kind === "event" && !item.completedAt).length, plannedEvents: activities.filter(item => item.ref.kind === "event" && item.status === "planned" && item.date && dates.includes(item.date)).length, strengthSets, cardio, focusSeconds: data.focus.filter(item => item.status === "saved" && dates.includes(item.date)).reduce((sum, item) => sum + (item.confirmedSeconds ?? 0), 0), restDays: sources.gym.restDays.filter(date => dates.includes(date)).length, adjustments: data.adjustments.filter(item => dates.includes(item.date)).length, asOf: now };
}
export function milestoneKeys(data: MomentumData, activities: Activity[]) {
  const keys: string[] = [];
  for (const journey of data.journeys) {
    for (const chapter of journey.chapters.filter(chapter => chapterDone(chapter, activities))) keys.push(`chapter:${journey.id}:${chapter.id}`);
    if (journey.chapters.length && journey.chapters.every(chapter => chapterDone(chapter, activities))) keys.push(`journey:${journey.id}`);
  }
  for (const review of data.reviews.filter(review => !review.draft)) keys.push(`review:${review.id}`);
  return keys;
}
export function addAwards(data: MomentumData, activities: Activity[], at: string) {
  const existing = new Set(data.awards.map(item => item.key));
  return { ...data, awards: [...data.awards, ...milestoneKeys(data, activities).filter(key => !existing.has(key)).map(key => ({ key, at }))] };
}
export function currencyDecimals(currency: Currency) { return currency === "JPY" ? 0 : currency === "KWD" ? 3 : 2; }
export function parseMoney(value: string, currency: Currency) {
  const decimals = currencyDecimals(currency), match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > decimals) throw new Error(`Choose a non-negative amount with at most ${decimals} decimal places`);
  const minor = Number(match[1]) * 10 ** decimals + Number((match[2] ?? "").padEnd(decimals, "0"));
  if (!Number.isSafeInteger(minor) || minor > 1e12) throw new Error("Choose a smaller amount");
  return minor;
}
export function moneyInput(minor: number, currency: Currency) { return (minor / 10 ** currencyDecimals(currency)).toFixed(currencyDecimals(currency)); }
export function formatMoney(minor: number, currency: Currency) { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 10 ** currencyDecimals(currency)); }
export function savingsBalance(goal: MomentumData["savings"][number]) { return goal.entries.reduce((total, item) => total + (item.type === "contribution" ? item.amountMinor : -item.amountMinor), goal.openingMinor); }
