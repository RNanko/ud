import { addCalendarDays, dateInZone, weekStart } from "../../gym/dates";
import { elapsedFocus, formatMoney, sourceKey } from "../logic";
import type { Activity, MomentumData, Sources } from "../types";
import { emptyTracker, type GoalContribution, type GoalEvaluation, type GoalRule, type GoalTrackerData, type TrackedGoal } from "./types";
export const trackerFor = (data: MomentumData): GoalTrackerData => data.tracker ?? emptyTracker();
const dayBoundaries = new Map<string, number>();
export function localDayInstant(date: string, timezone: string) {
  const key = `${timezone}:${date}`, cached = dayBoundaries.get(key);
  if (cached !== undefined) return cached;
  const center = Date.parse(`${date}T12:00:00Z`);
  let low = center - 48 * 3600000, high = center + 36 * 3600000;
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (dateInZone(new Date(mid), timezone) < date) low = mid; else high = mid; }
  if (dayBoundaries.size >= 2000) dayBoundaries.clear();
  dayBoundaries.set(key, high); return high;
}
export function nextMonth(date: string) { const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7)); return `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`; }
export function goalWindow(rule: GoalRule, date: string) {
  if (rule.end && date > rule.end) date = rule.end;
  const start = rule.period === "weekly" ? weekStart(date,rule.weekStartsOn??"monday") : rule.period === "monthly" ? `${date.slice(0, 7)}-01` : rule.start;
  const end = rule.period === "weekly" ? addCalendarDays(start, 6) : rule.period === "monthly" ? addCalendarDays(nextMonth(start), -1) : rule.end;
  const label = rule.period === "ongoing" ? "Ongoing" : rule.period === "monthly" ? `${start.slice(0, 7)} · calendar month` : rule.period === "weekly" ? `${start} – ${end} · calendar week` : `${start} – ${end}`;
  return { key: `${rule.period}:${start}`, start: start < rule.start ? rule.start : start, end: end && rule.end && rule.end < end ? rule.end : end, label };
}
export function versionFor(goal: TrackedGoal, date: string) { return goal.versions.filter(version => version.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.revision - a.revision)[0] ?? goal.versions[0]; }
export function ruleText(rule: GoalRule, data: MomentumData) {
  const scope = trackerFor(data).scopes.find(item => item.id === rule.scopeId), pot = data.savings.find(item => item.id === rule.scopeId);
  switch (rule.metric) {
    case "balance": return `Keep a recorded cash balance of at least ${formatMoney(rule.target, rule.currency!)} in “${scope?.name ?? "missing scope"}”${rule.throughout ? " throughout the period (requires explicitly confirmed coverage)" : ". Evaluate the latest dated balance, then later settled movements"}.`;
    case "savings": return `Net contributions minus withdrawals to “${pot?.name ?? "missing allocation"}” in this period. Opening allocated balance never counts as new saving.`;
    case "investment": return `Confirmed external contributions minus withdrawals to “${scope?.name ?? "missing account"}”. Opening value, gains, dividends and internal trades never count.`;
    case "sessions": return "Count distinct completed Gym session IDs. Linked Events and cardio inside a session do not count again. Includes workouts recorded in Gym, without inferring a venue or visit.";
    case "training-days": return "Count different actual local training dates with completed Gym sessions. Several sessions on one date count as one day; no gym-location inference.";
    case "events": return rule.sources.length ? "Count confirmed completion of the explicitly selected manual Events occurrences. A passed time or scheduled duration is not attendance." : "Count confirmed manual Events occurrences in the period. Gym-linked events are excluded.";
    case "visits": return `Count unique personally confirmed visit/group references in “${scope?.name ?? "missing activity"}”. No location is inferred from exercises.`;
    case "minutes": return `Saved focus time for the selected source actions/journey, plus eligible manual intervals in “${scope?.name ?? "selected activity"}”. Pauses, unsaved time and overlaps are excluded. A linked manual/timer record counts once.`;
  }
}
function unionIntervals(values: [number, number][]) {
  const sorted = values.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]); let total = 0, end = -Infinity;
  for (const [start, stop] of sorted) { total += Math.max(0, stop - Math.max(start, end)); end = Math.max(end, stop); }
  return Math.floor(total / 1000);
}
function digest(value: unknown) {
  // JSONB may return object keys in a different order. That is not a source correction.
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonical(nested)])) : item;
  let hash = 2166136261; for (const c of JSON.stringify(canonical(value))) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return (hash >>> 0).toString(16);
}
export function evaluateGoal(goal: TrackedGoal, data: MomentumData, sources: Sources & { activities?: Activity[] }, now: string, date?: string): GoalEvaluation {
  const anchor = date ?? dateInZone(new Date(now), goal.versions.at(-1)!.rule.timezone), version = versionFor(goal, anchor), rule = version.rule, period = goalWindow(rule, anchor), tracker = trackerFor(data);
  const startInstant = localDayInstant(period.start, rule.timezone), endInstant = period.end ? localDayInstant(addCalendarDays(period.end, 1), rule.timezone) : Date.parse(now) + 1, cutoff = Math.min(Date.parse(now), endInstant - 1), ended = !!period.end && period.end < dateInZone(new Date(now), rule.timezone);
  const inPeriod = (d: string) => d >= period.start && (!period.end || d <= period.end) && d <= dateInZone(new Date(now), rule.timezone);
  const contributions: GoalContribution[] = [], limitations: string[] = []; let value: number | null = 0, asOf: string | null = now, met = false, balanceBreach = false, coverage = true, staleBalance = false;
  const scope = tracker.scopes.find(item => item.id === rule.scopeId), selected = new Set(rule.sources.map(sourceKey));
  const source = ["sessions", "training-days"].includes(rule.metric) ? "Gym · canonical completed sessions" : rule.metric === "events" ? "Events · confirmed occurrences" : rule.metric === "savings" ? "Momentum savings allocation journal" : rule.metric === "minutes" ? "Saved focus intervals / manual activity intervals" : `Manually recorded · ${scope?.name ?? "scope unavailable"}`;
  const next: GoalEvaluation["next"] = { label: "Record an update", href: null, source: null };
  if(rule.metric==="investment"&&rule.currency!=="USD"){value=null;limitations.push("Legacy non-USD investment goal preserved. USD-only policy excludes this goal from supported progress; explicit migration is required.");}
  else if (["sessions", "training-days"].includes(rule.metric)) {
    const sessions = [...new Map(sources.gym.sessions.filter(x => x.data.status === "completed" && inPeriod(x.data.date)).map(x => [x.id, x])).values()];
    const seen = new Set<string>();
    for (const session of sessions) { const key = rule.metric === "training-days" ? session.data.date : session.id; const amount = seen.has(key) ? 0 : 1; seen.add(key); contributions.push({ key: `gym:${session.id}`, label: `${session.data.name}${session.data.completionMode === "confirmation" ? " · Completed — no details logged" : ""}`, value: amount, date: session.data.date, href: `/account/gym?session=${session.id}`, manual: false }); }
    value = seen.size; limitations.push("Recorded Gym workouts are not verified gym visits. Missing logs do not prove inactivity.");
    const plan = sources.gym.plans.filter(x => inPeriod(x.date) && x.date >= dateInZone(new Date(now), rule.timezone) && !sources.gym.sessions.some(session => session.planId === x.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
    next.label = plan ? `Open planned workout · ${plan.date}${plan.data.timing?.start ? ` ${plan.data.timing.start}` : ""}` : "Plan a session"; next.href = plan ? `/account/gym?plan=${plan.id}&date=${plan.date}` : "/account/gym";
  } else if (rule.metric === "events") {
    // Event adapter resolves exactly the same stable occurrence references as Momentum.
    for (const activity of sources.activities ?? []) if (activity.ref.kind === "event" && activity.status === "completed" && activity.date && inPeriod(activity.date) && (!selected.size || selected.has(activity.key))) contributions.push({ key: activity.key, label: activity.title, value: 1, date: activity.date, href: activity.href, manual: false });
    value = contributions.length; limitations.push("Only user-confirmed source completion counts; unknown actual dates use labeled scheduled context."); next.label = "Open Events"; next.href = "/account/events";
  } else if (rule.metric === "savings") {
    const pot = data.savings.find(x => x.id === rule.scopeId);
    if (!pot || pot.currency !== rule.currency) { value = null; limitations.push("The selected allocation is missing or its currency does not match."); }
    else { const entries = pot.entries.filter(x => inPeriod(x.date)); for (const item of entries) contributions.push({ key: `allocation:${item.id}`, label: `${item.allocationRef} · ${item.type}`, value: item.type === "contribution" ? item.amountMinor : -item.amountMinor, date: item.date, href: null, manual: true }); value = contributions.reduce((sum, item) => sum + item.value, 0); asOf = entries.at(-1)?.date ?? null; limitations.push("Manually recorded allocations; completeness is not bank-verified. Opening balance is excluded."); } next.label = "Record contribution";
  } else if (rule.metric === "minutes") {
    const journey = data.journeys.find(x => x.id === rule.journeyId); for (const chapter of journey?.chapters ?? []) for (const ref of chapter.links) selected.add(sourceKey(ref));
    const intervals: [number, number][] = [], focusIds = new Set<string>();
    for (const focus of data.focus.filter(x => x.status === "saved" && x.source && selected.has(sourceKey(x.source)))) {
      focusIds.add(focus.id); let remaining = Math.min(focus.confirmedSeconds ?? 0, elapsedFocus(focus, Date.parse(now))), seconds = 0;
      for (const interval of focus.intervals) { const start = Date.parse(interval.start), end = Math.min(Date.parse(interval.end ?? interval.start), start + remaining * 1000); remaining -= Math.max(0, (end - start) / 1000); const clipped: [number, number] = [Math.max(start, startInstant), Math.min(end, endInstant, cutoff + 1)]; if (clipped[1] > clipped[0]) { intervals.push(clipped); seconds += (clipped[1] - clipped[0]) / 1000; } }
      if (seconds) contributions.push({ key: `focus:${focus.id}`, label: "Saved focus · duration confirmed by you", value: seconds / 60, date: focus.date, href: "/account/momentum", manual: false });
    }
    for (const record of tracker.records.filter(x => x.scopeId === rule.scopeId && x.kind === "duration")) { if (record.linkedFocusId) { if (!focusIds.has(record.linkedFocusId)) limitations.push(`Linked timer ${record.reference} is unavailable or not eligible; its manual copy is excluded.`); continue; } const start = Math.max(Date.parse(record.occurredAt), startInstant), end = Math.min(Date.parse(record.occurredAt) + record.value * 1000, endInstant, cutoff + 1); if (end > start) { intervals.push([start, end]); contributions.push({ key: `manual:${record.id}`, label: `Manually recorded · ${record.reference}`, value: (end - start) / 60000, date: record.date, href: null, manual: true }); } }
    value = unionIntervals(intervals) / 60; limitations.push("Overlapping intervals count once; individual contributing rows may sum to more than the reconciled total. Corrected timer time is allocated from its earliest recorded intervals. No device-verified attention.");
    if (rule.journeyId && !journey) { value = null; limitations.push("The linked journey was removed. Choose a source before evaluating."); }
    const ref = rule.sources.find(x => x.kind === "task") ?? [...(journey?.chapters.flatMap(x => x.links) ?? [])].find(x => x.kind === "task"); next.label = ref ? "Start 25 minutes" : "Record actual duration"; next.source = ref ?? null;
  } else if (!scope || (rule.currency && scope.currency !== rule.currency)) { value = null; limitations.push("Selected source scope is unavailable or currency mismatches; no reliable zero is assumed."); }
  else {
    const records = tracker.records.filter(x => x.scopeId === scope.id && Date.parse(x.occurredAt) <= cutoff).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    if (rule.metric === "visits") { const seen = new Set<string>(); for (const record of records.filter(x => x.kind === "visit" && inPeriod(dateInZone(new Date(x.occurredAt), rule.timezone)))) { if (seen.has(record.reference.toLowerCase())) continue; seen.add(record.reference.toLowerCase()); contributions.push({ key: `manual:${record.id}`, label: `Confirmed visit/group · ${record.reference}`, value: 1, date: record.date, href: null, manual: true }); } value = seen.size; limitations.push("Personal confirmation; no venue or location monitoring."); next.label = "Record a confirmed visit"; }
    else if (rule.metric === "investment") { for (const record of records.filter(x => ["contribution", "withdrawal"].includes(x.kind) && inPeriod(dateInZone(new Date(x.occurredAt), rule.timezone)))) contributions.push({ key: `manual:${record.id}`, label: `Manual external ${record.kind} · ${record.reference}`, value: record.kind === "contribution" ? record.value : -record.value, date: record.date, href: null, manual: true }); value = contributions.reduce((sum, x) => sum + x.value, 0); asOf = contributions.at(-1)?.date ?? null; limitations.push("No broker connection. No contribution recorded is not proof that no contribution occurred. Trades, dividends and market values are excluded."); next.label = "Record contribution"; }
    else {
      const snapshots = records.filter(x => x.kind === "snapshot"), base = [...snapshots].reverse().find(x => !rule.throughout || Date.parse(x.occurredAt) <= startInstant);
      if (!base) { value = null; asOf = null; limitations.push("Record a dated opening/authoritative balance before the period. Missing movements are not assumed to be zero."); }
      else { value = base.value; asOf = base.occurredAt; const relevant = records.filter(x => Date.parse(x.occurredAt) > Date.parse(base.occurredAt) && ["snapshot", "cash-in", "cash-out"].includes(x.kind)); contributions.push({ key: `manual:${base.id}`, label: `Dated recorded balance · ${base.reference}`, value: base.value, date: base.date, href: null, manual: true }); balanceBreach = rule.throughout && base.value < rule.target;
        for (const item of relevant) { const amount = item.kind === "snapshot" ? item.value - value! : item.kind === "cash-in" ? item.value : -item.value; value! += amount; asOf = item.occurredAt; contributions.push({ key: `manual:${item.id}`, label: `${item.kind === "snapshot" ? "Authoritative snapshot resets included movements" : "Settled manual movement"} · ${item.reference}`, value: amount, date: item.date, href: null, manual: true }); if (Date.parse(item.occurredAt) >= startInstant && value! < rule.target) balanceBreach = true; }
        const requiredDate = ended ? period.end! : dateInZone(new Date(now), rule.timezone); coverage = [base, ...relevant].some(x => x.confirmedThrough && x.confirmedThrough >= requiredDate);
        if (!coverage) limitations.push("Balance coverage has gaps: later unrecorded movements may change this amount. Confirm statement coverage only after checking all settled movements.");
        staleBalance = addCalendarDays(dateInZone(new Date(asOf!), rule.timezone), rule.freshnessDays) < requiredDate;
        if (staleBalance) limitations.push("Last recorded balance movement is stale for your chosen freshness threshold. The recorded amount is retained, but current attainment is not confirmed.");
      } limitations.push("Based on recorded balance, not a bank feed. Internal transfers inside this named scope cancel; record an outgoing/incoming movement only when it leaves/enters the selected scope. Surplus is not a safe-to-spend claim."); next.label = "Record balance / movement";
    }
  }
  if (["minutes", "events"].includes(rule.metric) && rule.sources.some(ref => !(sources.activities ?? []).some(x => x.key === sourceKey(ref)) && !(rule.metric === "minutes" && data.focus.some(x => x.status === "saved" && x.source && sourceKey(x.source) === sourceKey(ref))))) { value = null; limitations.push("A selected source was removed or is unavailable. Update the filter; disconnected data is not a reliable zero."); }
  const future = period.start > dateInZone(new Date(now), rule.timezone); met = value !== null && value >= rule.target && !future;
  if (staleBalance) met = false;
  if (rule.metric === "balance" && rule.throughout) met = met && coverage && !balanceBreach;
  let status = value === null ? "Needs update / insufficient data" : future ? "Period has not started" : rule.metric === "balance" ? balanceBreach && rule.throughout ? "Below minimum during recorded period" : !coverage && rule.throughout ? "Needs update / coverage gaps" : met ? "Above minimum now" : "Below minimum" : ended ? `Period ended — target ${met ? "met" : "not met"} in recorded data` : met ? rule.metric === "investment" && rule.period === "monthly" ? "Monthly contribution target met" : "Target met this period" : "In progress — recorded data";
  if (staleBalance) status = "Needs update / stale recorded balance";
  if (goal.lifecycle !== "active") status = `${goal.lifecycle === "paused" ? "Paused" : "Archived"} · ${status}`;
  const signature = digest({ rule, value, contributions: contributions.map(x => [x.key, x.value, x.date]), coverage, balanceBreach, staleBalance });
  const old = tracker.history.find(x => x.goalId === goal.id && x.key === period.key);
  return { goalId: goal.id, period, version: version.revision, rule, ruleText: ruleText(rule, data), value, remaining: value === null ? null : Math.max(0, rule.target - value), buffer: rule.metric === "balance" && value !== null ? value - rule.target : null, met, status, contributions, source, asOf, limitations, next, signature, revised: !!old && (old.signature !== signature || !!old.revisedAt) };
}
export function reminderKey(goal: TrackedGoal, evaluation: GoalEvaluation, date: string) { return `${goal.id}:${evaluation.period.key}:${evaluation.rule.metric === "balance" ? evaluation.signature : date}`; }
export function reminderDue(goal: TrackedGoal, evaluation: GoalEvaluation, tracker: GoalTrackerData, now: string) {
  if (!goal.reminder.enabled || goal.lifecycle !== "active" || goal.hidden || evaluation.met || evaluation.period.start > dateInZone(new Date(now), evaluation.rule.timezone)) return null;
  const date = dateInZone(new Date(now), evaluation.rule.timezone), clock = new Intl.DateTimeFormat("en-GB", { timeZone: evaluation.rule.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now));
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(), lead = goal.reminder.leadDays !== null && evaluation.period.end && date >= addCalendarDays(evaluation.period.end, -goal.reminder.leadDays);
  if ((!goal.reminder.days.includes(day) && !lead) || clock < goal.reminder.time || evaluation.period.end && date > evaluation.period.end) return null;
  const key = reminderKey(goal, evaluation, date), receipt = tracker.reminders.find(x => x.key === key);
  if (tracker.reminders.some(x => x.goalId === goal.id && x.state === "snoozed" && x.until && x.until > now)) return null;
  if (receipt && (receipt.state === "dismissed" || receipt.until && receipt.until > now)) return null;
  return key;
}
