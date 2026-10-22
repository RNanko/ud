"use client";
import { notifyScheduleChange } from "@/lib/events/schedule-signal";

import { useState } from "react";
import { useBackgroundSave } from "./use-background-save";
import { BackgroundSaveError } from "@/lib/background-save-queue";
import { placeManual, weekdays, plannerItems } from "@/lib/events";
import { activityFeed } from "@/lib/events/activity-feed";
import { newSession } from "@/lib/gym/logic";
import { setPlannerActivityCompletion } from "@/lib/actions/activity.actions";
import type { ActivityCompletion } from "@/lib/events/activity-completion";
import { activityRequest } from "@/lib/events/request-timeout";
import { weekDates } from "@/lib/gym/dates";
import { untimed } from "@/lib/planner-time";
import { saveEventBoard } from "@/lib/actions/planner.actions";
import { saveAccountEventWindow } from "@/lib/actions/calendar-window.actions";
import { saveScheduledEvent } from "@/lib/actions/event-schedules.actions";
import { moveGymPlan } from "@/lib/actions/gym.actions";
import { notifyGymChange } from "./use-gym-sync";
import type { EventContainer, EventItem, EventItems } from "@/types/types";
import type { GymData, PlanRecord } from "@/lib/gym/types";
import type { WorkoutLink } from "@/lib/gym/event-links";

type Snapshot = { events: EventContainer; gym: GymData };
type Move = { kind: "event" | "workout"; id: string; date: string; order: number; anchor: string; sunday: boolean };
type Completion = { kind: "completion"; id: string; completed: boolean; completedAt: string | null; anchor: string; sunday: boolean };
type Link = { kind: "link"; id: string; workoutLink: WorkoutLink | null; anchor: string; sunday: boolean };
type Change = Move | Completion | Link;
type Command = { base: Snapshot } & (
  | { kind: "completion"; payload: ActivityCompletion }
  | { kind: "event"; sunday: boolean; anchor: string; payload: { week: string; mutationId: string; before: EventItems[]; data: EventItems[] } }
  | { kind: "scheduled"; next: Snapshot; payload: { operationId: string; before: EventItem; event: EventItem; date: string } }
  | { kind: "workout"; payload: { id: string; revision: number; mutationId: string; date: string; timezone: string; from: string; timing: PlanRecord["data"]["timing"] } }
);

function change(snapshot: Snapshot, input: Change): Snapshot {
  if (input.kind === "completion" && input.id.startsWith("workout:")) {
    const activity = activityFeed([], snapshot.gym, "UTC").find(event => event.id === input.id);
    if (!activity) return snapshot;
    const session = snapshot.gym.sessions.find(row => `session:${row.id}` === activity.locator);
    const plan = snapshot.gym.plans.find(row => `workout:plan:${row.id}` === activity.id);
    const current = session ?? (plan ? { id: `optimistic:${plan.id}`, revision: -1, planId: plan.id, data: newSession(plan.data, plan.date, plan.timezone, true, true) } : null);
    if (!current) return snapshot;
    const next = { ...current, data: { ...current.data, status: input.completed ? "completed" as const : "active" as const, completionMode: current.data.completionMode ?? "confirmation" as const, finishedAt: input.completedAt } };
    return { ...snapshot, gym: { ...snapshot.gym, sessions: [...snapshot.gym.sessions.filter(row => row.id !== current.id), next] } };
  }
  if (input.kind === "completion" || input.kind === "link") {
    return { ...snapshot, events: { ...snapshot.events, dayData: snapshot.events.dayData.map(day => ({
      ...day,
      tasks: day.tasks.map(event => event.id === input.id
        ? { ...event, ...(input.kind === "link" ? { workoutLink: input.workoutLink } : { completed: input.completed, completedAt: input.completedAt }) }
        : event),
    })) } };
  }
  if (input.kind === "event") {
    const event = snapshot.events.dayData.flatMap(day => day.tasks).find(event => event.id === input.id);
    if (!event) return snapshot;
    return { ...snapshot, events: { ...snapshot.events, dayData: placeManual(snapshot.events.dayData, { ...event, order: input.order }, input.date) } };
  }
  return { ...snapshot, gym: { ...snapshot.gym, plans: snapshot.gym.plans.map(plan => plan.id === input.id
    ? { ...plan, date: input.date, data: { ...plan.data, timing: { ...(plan.data.timing || untimed()), order: input.order } } }
    : plan) } };
}

export function usePlannerMoves(initial: Snapshot, apply: (snapshot: Snapshot) => void, owner: string) {
  const [expectedOwner] = useState(owner);
  const saves = useBackgroundSave<Snapshot, Change, Command>(initial, {
    owner: expectedOwner,
    reduce: change,
    apply,
    prepare: (base, input) => {
      if (input.kind === "completion") {
        const workout = input.id.startsWith("workout:");
        const item = workout ? undefined : plannerItems(base.events.dayData, base.gym, input.anchor, input.sunday ? "sunday" : "monday").find(item => item.manual?.id === input.id);
        const activity = workout ? activityFeed([], base.gym, "UTC").find(event => event.id === input.id) : undefined;
        const ref = item?.manual?.scheduled;
        const version = activity?.version ?? (ref ? `${ref.scheduleRevision}:${ref.revision}` : item?.manual ? JSON.stringify(item.manual) : undefined);
        const date = activity?.date ?? item?.date;
        if (!version || !date) throw new BackgroundSaveError("This activity changed elsewhere. Reload before checking it.", "conflict", base);
        return { kind: "completion", base, payload: { operationId: crypto.randomUUID(), id: workout ? input.id : `event:${input.id}`, date, version, completed: input.completed } };
      }
      if (input.kind !== "workout" && !base.events.dayData.some(day => day.tasks.some(event => event.id === input.id))) throw new BackgroundSaveError("This event changed elsewhere. Use the saved version before changing it.", "conflict", base);
      const next = change(base, input);
      if (input.kind !== "workout") {
        const before = base.events.dayData.flatMap(day => day.tasks).find(e => e.id === input.id)!;
        if (before.scheduled) {
          const event = next.events.dayData.flatMap(day => day.tasks).find(e => e.id === input.id)!;
          const day = next.events.dayData.find(day => day.tasks.some(e => e.id === input.id))!;
          const dates = weekDates(input.anchor, input.sunday ? "sunday" : "monday");
          const date = dates.find(d => weekdays[(new Date(`${d}T12:00:00Z`).getUTCDay()+6)%7] === day.day)!;
          return { kind: "scheduled", base, next, payload: { operationId: crypto.randomUUID(), before, event, date } };
        }
      }
      if (input.kind !== "workout") return {
        kind: "event", base, sunday: input.sunday, anchor: input.anchor,
        payload: { week: base.events.week, mutationId: crypto.randomUUID(), before: base.events.dayData, data: next.events.dayData },
      };
      const plan = next.gym.plans.find(plan => plan.id === input.id);
      if (!plan) throw new BackgroundSaveError("This workout changed elsewhere. Reload before moving it.", "conflict", base);
      return { kind: "workout", base, payload: { id: plan.id, revision: plan.revision, mutationId: crypto.randomUUID(), date: plan.date, timezone: plan.timezone, from: base.gym.plans.find(p => p.id === plan.id)!.date, timing: plan.data.timing } };
    },
    save: async command => {
      if (command.kind === "completion") {
        try {
          const record = await activityRequest(setPlannerActivityCompletion(command.payload, expectedOwner));
          notifyGymChange(); notifyScheduleChange();
          if (record.event) return { ...command.base, events: { ...command.base.events, dayData: placeManual(command.base.events.dayData, record.event, record.occurrence.date) } };
          const planId = record.plan?.id ?? record.session?.planId;
          return { ...command.base, gym: { ...command.base.gym,
            plans: record.plan ? [...command.base.gym.plans.filter(p => p.id !== planId), record.plan] : command.base.gym.plans,
            sessions: [...command.base.gym.sessions.filter(s => planId ? s.planId !== planId : `workout:session:${s.id}` !== command.payload.id), ...(record.session ? [record.session] : [])],
          } };
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "Could not confirm completion. Retry safely.";
          throw new BackgroundSaveError(message, /^Newer/.test(message) ? "conflict" : /^(Choose|This|Activity checkboxes)/.test(message) ? "rejected" : "unknown");
        }
      }
      if (command.kind === "scheduled") {
        const result = await saveScheduledEvent(command.payload, expectedOwner);
        if (!result.success) throw new BackgroundSaveError(result.message, /^Newer/.test(result.message) ? "conflict" : "unknown");
        const event = { ...command.payload.event, scheduled: { ...command.payload.before.scheduled!, revision: result.data.revision } };
        window.dispatchEvent(new Event("notifications-changed"));
        notifyScheduleChange();
        return { ...command.next, events: { ...command.next.events, dayData: placeManual(command.next.events.dayData, event, result.data.date) } };
      }
      if (command.kind === "event") {
        const result = command.sunday
          ? await saveAccountEventWindow({ anchor: command.anchor, before: command.payload.before, data: command.payload.data }, true, expectedOwner)
          : await saveEventBoard(command.payload, true, expectedOwner);
        if (!result.success) throw new BackgroundSaveError(result.message, /^(Newer|Workout)/.test(result.message) ? "conflict" : "unknown");
        window.dispatchEvent(new Event("notifications-changed"));
        window.dispatchEvent(new Event("workout-links-changed"));
        return { ...command.base, events: { ...command.base.events, dayData: result.data } };
      }
      const result = await moveGymPlan(command.payload, expectedOwner);
      if (!result.success) throw new BackgroundSaveError(result.message, /^(Newer|Workout|Choose)/.test(result.message ?? "") ? "conflict" : "unknown");
      notifyGymChange();
      return { ...command.base, gym: { ...command.base.gym, plans: command.base.gym.plans.map(plan => plan.id === result.plan.id ? result.plan : plan) } };
    },
  });
  const completions = new Map<string, { id: string; completed: boolean }>();
  if (saves.phase === "saving") {
    for (const input of saves.inputs) {
      if (input.kind === "completion") completions.set(input.id, { id: input.id, completed: input.completed });
    }
  }
  return { ...saves, completions: [...completions.values()] };
}
