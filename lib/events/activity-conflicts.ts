import { timeMinutes, type EventTiming } from "../planner-time";
type ConflictActivity = { id: string; locator: string; date: string; title: string; completed: boolean; timing?: EventTiming };
/** Local-time advisory only. Missing durations stay uncertain, not conflicts. */
export function activityConflicts(events: readonly ConflictActivity[], moving: string, locator: string, date: string, timing?: EventTiming) {
  const overlaps: string[] = [], uncertain: string[] = [];
  if (timing?.start) {
    const start = Date.parse(`${date}T00:00:00Z`) / 60000 + timeMinutes(timing.start), end = timing.duration ? start + timing.duration : null;
    for (const event of events.filter(row => !row.completed && row.id !== moving && row.locator !== locator && row.timing?.start)) {
      const candidate = Date.parse(`${event.date}T00:00:00Z`) / 60000 + timeMinutes(event.timing!.start!), candidateEnd = event.timing?.duration ? candidate + event.timing.duration : null;
      const label = `${event.title} · ${event.date} ${event.timing?.start}`;
      if (end !== null && candidateEnd !== null) { if (start < candidateEnd && candidate < end) overlaps.push(label); }
      else if (event.date === date || end !== null && candidate >= start && candidate < end || candidateEnd !== null && start >= candidate && start < candidateEnd) uncertain.push(label);
    }
  }
  return { overlaps, uncertain, untimed: !timing?.start };
}
