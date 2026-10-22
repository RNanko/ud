import type { EventItem } from "@/types/types";
import type { PlannerItem } from "../events";
import type { SessionRecord } from "./types";

export type WorkoutLink = NonNullable<EventItem["workoutLink"]>;

export function workoutLink(item: PlannerItem): WorkoutLink | null {
  if (item.plan) return { kind: "plan", id: item.plan.id };
  if (item.session) return { kind: "session", id: item.session.id };
  return null;
}

export function eventLinksWorkout(event: EventItem, item: PlannerItem) {
  const link = event.workoutLink;
  return !!link && (link.kind === "session"
    ? link.id === item.session?.id
    : link.id === (item.plan?.id || item.session?.planId));
}

export function workoutHistory(item: PlannerItem, sessions: readonly SessionRecord[]) {
  const blueprint = item.plan?.data || item.session?.data.originalPlan || item.session?.data;
  if (!blueprint) return [];
  const signature = (value: { name: string; exercises: { definition: { id: string } }[] }) => JSON.stringify([
    value.name.trim().toLocaleLowerCase(), value.exercises.map(exercise => exercise.definition.id),
  ]);
  const current = signature(blueprint);
  return sessions.filter(session => session.data.status === "completed" && (
    session.id === item.session?.id || (item.plan && session.planId === item.plan.id) ||
    signature(session.data.originalPlan || session.data) === current
  )).sort((a, b) => `${b.data.date}:${b.data.finishedAt || ""}`.localeCompare(`${a.data.date}:${a.data.finishedAt || ""}`));
}
