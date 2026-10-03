import { timeMinutes, type EventTiming } from "../planner-time";
import type { Activity, SourceRef } from "./types";
import { sourceKey } from "./logic";
export function scheduleConflicts(activities: Activity[], moving: SourceRef, date: string, timing: EventTiming | undefined) {
  if (!timing?.start) return { overlaps: [] as string[], uncertain: [] as string[], untimed: true };
  const start = Date.parse(`${date}T00:00:00Z`) / 60000 + timeMinutes(timing.start), end = timing.duration ? start + timing.duration : null;
  const overlaps: string[] = [], uncertain: string[] = [];
  for (const activity of activities.filter(item => item.key !== sourceKey(moving) && item.status === "planned" && item.date && item.timing?.start)) {
    const candidate = Date.parse(`${activity.date}T00:00:00Z`) / 60000 + timeMinutes(activity.timing!.start!), candidateEnd = activity.timing?.duration ? candidate + activity.timing.duration : null;
    if (end !== null && candidateEnd !== null) { if (start < candidateEnd && candidate < end) overlaps.push(`${activity.title} · ${activity.date} ${activity.timing?.start}`); }
    else if (activity.date === date || end !== null && candidate >= start && candidate < end || candidateEnd !== null && start >= candidate && start < candidateEnd) uncertain.push(`${activity.title} · ${activity.date} ${activity.timing?.start}`);
  }
  return { overlaps, uncertain, untimed: false };
}
