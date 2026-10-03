import { addCalendarDays, dateInZone } from "../../gym/dates";
import { sourceKey } from "../logic";
import type { Activity, MomentumData } from "../types";
import type { MomentumCommand } from "../validation";
import { goalWindow, trackerFor, versionFor } from "./evaluate";
export function reduceGoalCommand(data: MomentumData, command: MomentumCommand, context: { now: string; date: string; activities: Activity[] }) {
  if (!command.type.startsWith("goal-")) return;
  const tracker = data.tracker ??= trackerFor(data), { now, activities } = context;
  const requireGoal = (id: string) => { const goal = tracker.goals.find(x => x.id === id); if (!goal) throw new Error("Choose an existing goal"); return goal; };
  if (command.type === "goal-save") {
    const old = tracker.goals.find(x => x.id === command.id), rule = command.rule, today = dateInZone(new Date(now), rule.timezone), current = goalWindow(old ? versionFor(old, today).rule : rule, today);
    if (rule.journeyId && !data.journeys.some(x => x.id === rule.journeyId)) throw new Error("Choose an existing journey");
    for (const ref of rule.sources) if (!activities.some(x => x.key === sourceKey(ref))) throw new Error("Source action was removed. Choose an available action.");
    if (new Set(rule.sources.map(sourceKey)).size !== rule.sources.length) throw new Error("Choose each source only once");
    const pot = data.savings.find(x => x.id === rule.scopeId), scope = tracker.scopes.find(x => x.id === rule.scopeId);
    if (rule.metric === "savings" && (!pot || pot.currency !== rule.currency)) throw new Error("Choose an existing savings allocation with the same currency");
    if (["balance", "investment", "visits"].includes(rule.metric) || rule.metric === "minutes" && rule.scopeId) {
      const kind = rule.metric === "balance" ? "cash" : rule.metric === "investment" ? "investment" : "activity";
      if (!scope || scope.kind !== kind || scope.currency !== rule.currency) throw new Error("Choose a matching owned scope and currency");
      if (tracker.goals.some(x => x.id !== command.id && x.versions.some(v => v.rule.scopeId === scope.id && v.rule.timezone !== rule.timezone))) throw new Error("Choose the same timezone for goals sharing a manual record scope");
    }
    if (old && command.apply === "next" && !["weekly", "monthly"].includes(current.key.split(":")[0])) throw new Error("Choose a current revision for an ongoing or date-range rule");
    if (old && (old.versions[0].rule.period !== rule.period || old.versions[0].rule.timezone !== rule.timezone || old.versions[0].rule.start !== rule.start)) throw new Error("Create a separate goal to change the original calendar, timezone or start date; prior periods stay intact");
    const effectiveFrom = old ? command.apply === "next" ? addCalendarDays(current.end!, 1) : current.start : rule.start;
    if (rule.end && effectiveFrom > rule.end) throw new Error("Choose an end date after the revision takes effect");
    const revision = (old?.versions.at(-1)?.revision ?? 0) + 1;
    if (old && old.versions.length >= 120) throw new Error("Choose a new goal or export older rule versions before adding more");
    const value = { id: command.id, name: command.name, lifecycle: old?.lifecycle ?? "active" as const, pinned: old?.pinned ?? false, hidden: old?.hidden ?? false, order: old?.order ?? tracker.goals.length, versions: [...(old?.versions ?? []), { revision, effectiveFrom, rule }], reminder: command.reminder, createdAt: old?.createdAt ?? now, updatedAt: now };
    tracker.goals = [...tracker.goals.filter(x => x.id !== value.id), value];
  }
  if (command.type === "goal-card") {
    const goal = requireGoal(command.id); if (command.lifecycle) goal.lifecycle = command.lifecycle; if (command.pinned !== undefined) goal.pinned = command.pinned; if (command.hidden !== undefined) goal.hidden = command.hidden;
    if (command.direction) { const ordered = [...tracker.goals].sort((a, b) => a.order - b.order), index = ordered.findIndex(x => x.id === goal.id), swap = index + (command.direction === "up" ? -1 : 1); if (swap >= 0 && swap < ordered.length) { [ordered[index], ordered[swap]] = [ordered[swap], ordered[index]]; ordered.forEach((x, order) => x.order = order); } }
    goal.updatedAt = now;
  }
  if (command.type === "goal-delete") { requireGoal(command.id); tracker.goals = tracker.goals.filter(x => x.id !== command.id); tracker.history = tracker.history.filter(x => x.goalId !== command.id); tracker.reminders = tracker.reminders.filter(x => x.goalId !== command.id); tracker.attainments = tracker.attainments.filter(x => !x.key.startsWith(`${command.id}:`)); }
  if (command.type === "goal-scope") { const old = tracker.scopes.find(x => x.id === command.id); if (tracker.scopes.some(x => x.id !== command.id && x.name.toLowerCase() === command.name.toLowerCase())) throw new Error("Choose a distinct scope name"); if (old && (old.currency !== command.currency || old.kind !== command.kind)) throw new Error("Create a new scope instead of reinterpreting historical units"); if ((command.kind === "activity") === !!command.currency) throw new Error("Choose currency only for a cash or investment scope"); tracker.scopes = [...tracker.scopes.filter(x => x.id !== command.id), { id: command.id, name: command.name, kind: command.kind, currency: command.currency, createdAt: old?.createdAt ?? now }]; }
  if (command.type === "goal-record") {
    const entry = command.value, scope = tracker.scopes.find(x => x.id === entry.scopeId), old = tracker.records.find(x => x.id === entry.id);
    if (!scope || old && old.scopeId !== scope.id) throw new Error("Choose the existing record's scope");
    if(scope.kind==="investment"&&scope.currency!=="USD")throw new Error("Investments currently support USD only; legacy records remain unchanged");
    const kinds = scope.kind === "cash" ? ["snapshot", "cash-in", "cash-out"] : scope.kind === "investment" ? ["contribution", "withdrawal"] : ["duration", "visit"];
    if (!kinds.includes(entry.kind)) throw new Error("Choose a supported record type for this scope");
    if (entry.linkedFocusId && entry.kind !== "duration" || entry.confirmedThrough && entry.kind !== "snapshot") throw new Error("Choose timer links only for duration, and statement coverage only for a balance snapshot");
    if (entry.kind !== "snapshot" && entry.value <= 0) throw new Error("Enter a positive movement or duration");
    if (entry.kind === "visit" && entry.value !== 1) throw new Error("Record one confirmed visit/group per reference");
    const zone = tracker.goals.find(x => x.versions.some(v => v.rule.scopeId === scope.id))?.versions[0].rule.timezone ?? "UTC";
    if (entry.date !== dateInZone(new Date(entry.occurredAt), zone) || entry.occurredAt > now || entry.kind === "duration" && Date.parse(entry.occurredAt) + entry.value * 1000 > Date.parse(now)) throw new Error("Choose an actual past date/time in the scope's goal timezone");
    if (entry.confirmedThrough && (entry.confirmedThrough < entry.date || entry.confirmedThrough > dateInZone(new Date(now), zone))) throw new Error("Choose coverage through an actual current or past date");
    if (entry.linkedFocusId && !data.focus.some(x => x.id === entry.linkedFocusId && x.status === "saved")) throw new Error("Choose an owned saved focus log");
    if (tracker.records.some(x => x.id !== entry.id && x.reference.toLowerCase() === entry.reference.toLowerCase()) || data.savings.some(x => x.entries.some(e => e.allocationRef.toLowerCase() === entry.reference.toLowerCase()))) throw new Error("An allocation or activity reference is already used. Edit its original record, or explicitly split distinct portions.");
    tracker.records = [...tracker.records.filter(x => x.id !== entry.id), { ...entry, updatedAt: now }];
  }
  if (command.type === "goal-remove-record") tracker.records = tracker.records.filter(x => x.id !== command.id);
  if (command.type === "goal-remove-scope") {
    if (tracker.goals.some(x => x.versions.some(v => v.rule.scopeId === command.id))) throw new Error("Remove or replace goals referencing this scope before deleting its records; earlier rule versions still use it");
    tracker.scopes = tracker.scopes.filter(x => x.id !== command.id); tracker.records = tracker.records.filter(x => x.scopeId !== command.id);
  }
  if (command.type === "goal-hide-amounts") tracker.hideAmounts = command.value;
  if (command.type === "goal-reminder") { requireGoal(command.id); if (!command.key.startsWith(`${command.id}:`)) throw new Error("Choose the reminder for this goal"); if (command.action === "snooze" && (!command.until || command.until <= now)) throw new Error("Choose a future snooze time"); tracker.reminders = [...tracker.reminders.filter(x => x.key !== command.key), { key: command.key, goalId: command.id, state: command.action === "dismiss" ? "dismissed" : "snoozed", until: command.until }]; }
}
