"use client";

import { Play, Pencil, Copy, CalendarDays, Trash2, Check, Clock } from "lucide-react";
import { sessionSummary, decimalLabel, distanceDisplay, durationLabel } from "@/lib/gym/logic";
import { dateLabel } from "@/lib/gym/dates";
import type { ExerciseDefinition, PlanRecord, SessionRecord, Units } from "@/lib/gym/types";
import ExerciseIcon from "./ExerciseIcon";
import { GymButton } from "./GymUI";
import { GymReveal } from "./GymMotion";
export function WorkoutArtwork({ exercises }: { exercises: { definition: ExerciseDefinition }[] }) {
  if (!exercises.length) return null;
  return <div className="gym-workout-artwork" aria-label="Workout exercises">
    {exercises.slice(0, 3).map((exercise, index) => <span className="gym-art-stage gym-art-compact" key={`${exercise.definition.id}-${index}`}>
      <ExerciseIcon icon={exercise.definition.icon} exerciseId={exercise.definition.id} size={48} decorative={false} label={exercise.definition.name} />
    </span>)}
    {exercises.length > 3 && <span className="text-xs text-muted-foreground">+{exercises.length - 3} more</span>}
  </div>;
}
export function PlanCard({
  plan,
  onStart,
  onEdit,
  onMove,
  onDuplicate,
  onRemove
}: {
  plan: PlanRecord;
  onStart: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return <GymReveal><article data-workout-status="unconfirmed" className="gym-workout-card gym-workout-state rounded-2xl border p-4">
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
      <CalendarDays size={14} />Planned · Not confirmed</p>
    <h4 className="text-lg font-semibold text-foreground">{plan.data.name}</h4>
    <WorkoutArtwork exercises={plan.data.exercises} />
    <p className="mt-1 text-sm text-muted-foreground">{[...new Set(plan.data.exercises.map(exercise => exercise.definition.category))].join(" · ")}</p>
    <p className="my-3 text-sm text-muted-foreground">{plan.data.exercises.length} exercises{plan.data.estimatedMinutes !== null ? ` · ~${plan.data.estimatedMinutes} min` : ""}</p>
    <div className="flex flex-wrap gap-2">
      <GymButton tone="orange" onClick={onStart}>
        <Play />Start</GymButton>
      <GymButton aria-label={`Edit ${plan.data.name}`} onClick={onEdit}>
        <Pencil />
      </GymButton>
      <GymButton aria-label={`Move ${plan.data.name}`} onClick={onMove}>
        <CalendarDays />
      </GymButton>
      <GymButton aria-label={`Duplicate ${plan.data.name}`} onClick={onDuplicate}>
        <Copy />
      </GymButton>
      <GymButton aria-label={`Remove plan ${plan.data.name}`} onClick={onRemove}>
        <Trash2 />
      </GymButton>
    </div>
  </article></GymReveal>;
}
export function SessionCard({
  session,
  units,
  plan,
  onOpen,
  onRemove,
  onRemovePlan
}: {
  session: SessionRecord;
  units: Units;
  plan?: PlanRecord;
  onOpen: () => void;
  onRemove: () => void;
  onRemovePlan: () => void;
}) {
  const summary = sessionSummary(session.data),
    complete = session.data.status === "completed",
    status = complete ? "completed" : "in-progress";
  return <GymReveal><article data-workout-status={status} className="gym-workout-card gym-workout-state rounded-2xl border p-4">
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">{complete ? <Check size={14} /> : <Clock size={14} />}{complete ? summary.exercises ? "Completed" : "Completed — no details logged" : session.data.logged ? "Log in progress" : "In progress · Active workout"}</p>
    <h4 className="text-lg font-semibold text-foreground">{session.data.name}</h4>
    <WorkoutArtwork exercises={session.data.exercises} />
    <p className="my-2 text-sm text-muted-foreground">{summary.exercises} completed exercises · {summary.sets} strength sets{summary.timedSeconds > 0 ? ` · ${durationLabel(summary.timedSeconds)} timed work` : ""}</p>{Object.entries(summary.cardio).map(([activity, value]) => <p key={activity} className="text-sm text-muted-foreground">{activity}: {durationLabel(value.seconds)} · {value.knownDistances ? `${decimalLabel(distanceDisplay(value.distanceKm, units))} ${units.distance}${value.knownDistances < value.entries ? " known" : ""}` : "Distance unknown"}</p>)}<p className="mb-3 mt-2 text-xs text-muted-foreground">Actual date: {dateLabel(session.data.date)}{session.planId && ` · Linked to planned workout${plan ? ` on ${dateLabel(plan.date)}` : ""}`}</p>
    <div className="flex flex-wrap gap-2">
      <GymButton tone={status} onClick={onOpen}>{complete ? "Open details" : "Resume"}</GymButton>
      <GymButton aria-label={`Delete ${session.data.name} log`} onClick={onRemove}>
        <Trash2 />
      </GymButton>{plan && <GymButton onClick={onRemovePlan}>Remove linked plan</GymButton>}</div>
  </article></GymReveal>;
}
