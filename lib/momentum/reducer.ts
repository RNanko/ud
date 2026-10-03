import { weekStart } from "../gym/dates";
import { closeFocusInterval, elapsedFocus, sourceKey } from "./logic";
import { emptyMomentum, type Activity, type MomentumData, type Summary } from "./types";
import type { MomentumCommand } from "./validation";
import { reduceGoalCommand } from "./goals/reducer";
export function reduceMomentum(previous: MomentumData, command: MomentumCommand, context: { date: string; timezone: string; now: string; activities: Activity[]; summaryFor: (week: string) => Summary }): MomentumData {
  const data = structuredClone(previous), { date, timezone, now, activities } = context;
  const requireSource = (ref: import("./types").SourceRef) => { if (!activities.some(item => item.key === sourceKey(ref))) throw new Error("Source was removed or is unavailable. Choose another action."); };
  const day = () => { let current = data.days.find(item => item.date === date); if (!current) { current = { date, timezone, main: null, supporting: [], rest: false }; data.days.push(current); } return current; };
  if (command.type === "delete-all") return emptyMomentum();
  reduceGoalCommand(data, command, context);
  if (command.type === "preferences") data.preferences = command.value;
  if (command.type === "select") {
    if (command.selection) {
      requireSource(command.selection.source);
      if (command.selection.journeyId && !data.journeys.some(item => item.id === command.selection?.journeyId)) throw new Error("Choose an existing journey");
    }
    const current = day();
    if (command.slot === "main") {
      current.main = command.selection;
      if (command.selection) current.supporting = current.supporting.filter(item => sourceKey(item.source) !== sourceKey(command.selection!.source));
    } else {
      current.supporting = current.supporting.filter(item => sourceKey(item.source) !== command.removeKey);
      if (command.selection && !current.supporting.some(item => sourceKey(item.source) === sourceKey(command.selection!.source))) {
        if (current.main && sourceKey(current.main.source) === sourceKey(command.selection.source)) throw new Error("This is already your main mission");
        if (current.supporting.length >= 2) throw new Error("Choose at most two supporting actions");
        current.supporting.push(command.selection);
      }
    }
  }
  if (command.type === "thought") {
    if (command.action === "save" && !data.favorites.includes(command.index)) data.favorites.push(command.index);
    if (command.action === "unsave") data.favorites = data.favorites.filter(index => index !== command.index);
    if (command.action === "dismiss") { const thought = data.thoughts.find(item => item.date === date); if (thought) thought.dismissed = true; }
  }
  if (command.type === "journey") {
    const old = data.journeys.find(item => item.id === command.value.id);
    // Editing presentation never imports completion state from the client.
    const value = { ...command.value, template: old ? old.template : command.value.template, chapters: command.value.chapters.map(chapter => {
      const prior = old?.chapters.find(item => item.id === chapter.id);
      return { ...chapter, confirmedAt: prior?.criterion === chapter.criterion ? prior.confirmedAt : null };
    }) };
    for (const chapter of value.chapters) for (const ref of chapter.links) if (!old?.chapters.find(item => item.id === chapter.id)?.links.some(item => sourceKey(item) === sourceKey(ref))) requireSource(ref);
    if (value.priority !== "later" && value.status === "active" && data.journeys.some(item => item.id !== value.id && item.priority === value.priority && item.status === "active")) throw new Error(`Pause or move your current ${value.priority} journey to Later first`);
    data.journeys = [...data.journeys.filter(item => item.id !== value.id), value];
  }
  if (command.type === "delete-journey") {
    data.journeys = data.journeys.filter(item => item.id !== command.id);
    for (const item of data.days) for (const selection of [item.main, ...item.supporting]) if (selection?.journeyId === command.id) selection.journeyId = null;
    data.awards = data.awards.filter(item => !item.key.includes(command.id));
  }
  if (command.type === "chapter") {
    const journey = data.journeys.find(item => item.id === command.journeyId), chapter = journey?.chapters.find(item => item.id === command.chapterId);
    if (!chapter) throw new Error("Choose an existing chapter");
    if (command.links) { command.links.forEach(requireSource); chapter.links = command.links; chapter.confirmedAt = null; }
    if (command.confirm !== undefined) {
      if (chapter.links.length) throw new Error("Use the linked source to change completion");
      chapter.confirmedAt = command.confirm ? chapter.confirmedAt ?? now : null;
    }
  }
  if (command.type === "focus-start") {
    if (data.focus.some(item => item.id === command.id)) return data;
    if (data.focus.some(item => ["running", "paused", "awaiting"].includes(item.status))) throw new Error("Finish or discard the current focus session first");
    if (command.source) requireSource(command.source);
    data.focus.push({ id: command.id, source: command.source, date, timezone, plannedSeconds: command.minutes * 60, intervals: [{ start: now, end: null }], status: "running", confirmedSeconds: null, notes: "", savedAt: null });
  }
  if (command.type === "focus-control" || command.type === "focus-save") {
    const index = data.focus.findIndex(item => item.id === command.id);
    if (index < 0) throw new Error("Choose an existing focus session");
    let focus = data.focus[index];
    const time = Date.parse(now);
    if (focus.status === "discarded") throw new Error("This focus session was discarded");
    if (command.type === "focus-control") {
      if (focus.status === "saved") throw new Error("This focus session is already saved");
      if (command.action === "pause" || command.action === "finish" || command.action === "discard") {
        focus = closeFocusInterval(focus, time);
        focus.status = command.action === "pause" && elapsedFocus(focus, time) < focus.plannedSeconds ? "paused" : command.action === "discard" ? "discarded" : "awaiting";
      }
      if (command.action === "resume" && focus.status !== "running") {
        if (elapsedFocus(focus, time) >= focus.plannedSeconds) throw new Error("Confirm the elapsed session or explicitly extend it");
        focus = { ...focus, status: "running", intervals: [...focus.intervals, { start: now, end: null }] };
      }
      if (command.action === "extend") {
        if (focus.plannedSeconds + (command.minutes ?? 10) * 60 > 86400) throw new Error("Choose a new session after reviewing this one; its duration limit is one day");
        focus = closeFocusInterval(focus, time);
        focus = { ...focus, plannedSeconds: Math.min(86400, focus.plannedSeconds + (command.minutes ?? 10) * 60), status: "running", intervals: [...focus.intervals, { start: now, end: null }] };
      }
    } else {
      focus = closeFocusInterval(focus, time);
      if (command.seconds > elapsedFocus(focus, time)) throw new Error("Correct logged time down to the time actually recorded");
      focus = { ...focus, status: "saved", confirmedSeconds: command.seconds, notes: command.notes, savedAt: now };
    }
    data.focus[index] = focus;
  }
  if (command.type === "review") {
    const week = weekStart(command.week), existing = data.reviews.find(item => item.week === week);
    if (existing && existing.id !== command.id) throw new Error("Choose the existing review for this week");
    data.reviews = [...data.reviews.filter(item => item.week !== week), { id: command.id, week, version: (existing?.version ?? 0) + (command.refreshSummary || !existing ? 1 : 0), summary: existing && !command.refreshSummary ? existing.summary : context.summaryFor(week), worthwhile: command.worthwhile, obstacle: command.obstacle, change: command.change, manageable: command.manageable, draft: command.draft, savedAt: now }];
  }
  if (command.type === "savings") {
    const old = data.savings.find(item => item.id === command.value.id);
    if (old && old.currency !== command.value.currency && (old.entries.length || old.openingMinor)) throw new Error("Create a separate goal for a different currency; existing amounts keep their currency");
    if (command.value.openingDate > date) throw new Error("Choose a current or past opening date");
    if (old?.entries.some(entry => entry.date < command.value.openingDate)) throw new Error("Choose an opening date on or before the journal entries; review those allocations before changing the period");
    data.savings = [...data.savings.filter(item => item.id !== command.value.id), { ...command.value, entries: old?.entries ?? [] }];
  }
  if (command.type === "delete-savings") data.savings = data.savings.filter(item => item.id !== command.id);
  if (command.type === "entry" || command.type === "delete-entry") {
    const goal = data.savings.find(item => item.id === command.goalId);
    if (!goal) throw new Error("Choose an existing savings goal");
    if (command.type === "entry") {
      if (data.tracker?.records.some(entry => entry.reference.toLowerCase() === command.value.allocationRef.toLowerCase())) throw new Error("An allocation reference is already used by the Goal Tracker. Edit the original, or split distinct portions explicitly.");
      if (command.value.date > date || command.value.date < goal.openingDate) throw new Error("Choose a current or past date on or after the opening balance date");
      if (data.savings.some(item => item.id !== goal.id && item.entries.some(entry => entry.id === command.value.id))) throw new Error("An allocation belongs to one goal. Split it explicitly with separate amounts.");
      if (data.savings.some(item => item.entries.some(entry => entry.id !== command.value.id && entry.allocationRef.toLocaleLowerCase("en") === command.value.allocationRef.toLocaleLowerCase("en")))) throw new Error("An allocation reference is already used. Split the real amount explicitly and label each part with a distinct reference.");
      goal.entries = [...goal.entries.filter(item => item.id !== command.value.id), command.value];
    } else goal.entries = goal.entries.filter(item => item.id !== command.id);
  }
  if (command.type === "adjustment" && !data.adjustments.some(item => item.id === command.id)) data.adjustments.push({ id: command.id, date, kind: command.kind });
  if (command.type === "rest") day().rest = command.value;
  return data;
}
