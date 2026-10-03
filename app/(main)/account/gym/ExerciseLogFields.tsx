"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { blankSet, decimalLabel, distanceDisplay, distanceStore, durationLabel, speed, weightDisplay, weightStore, validStrengthSet as validSet, validCardioLog } from "@/lib/gym/logic";
import type { SessionExercise, StrengthSet, Units } from "@/lib/gym/types";
import { GymButton, Notes, NumberField } from "./GymUI";
import { GymReveal } from "./GymMotion";
export { validSet };
export function actualLabel(exercise: SessionExercise, units: Units) {
  if (exercise.cardio?.completed) {
    const cardio = exercise.cardio;
    return `${durationLabel(cardio.seconds || 0)} · ${cardio.distanceKm === null ? "Distance unknown" : `${decimalLabel(distanceDisplay(cardio.distanceKm, units))} ${units.distance}`}`;
  }
  return exercise.sets.filter(set => set.completed).map(set => `${set.warmup ? "Warm-up: " : ""}${exercise.definition.tracking === "duration" ? durationLabel(set.seconds || 0) : `${set.loadKg !== null && exercise.definition.tracking !== "reps" ? `${exercise.definition.tracking === "assistance-reps" ? "Assistance " : ""}${decimalLabel(weightDisplay(set.loadKg, units))} ${units.weight} × ` : ""}${set.reps} reps`}${exercise.definition.perSide ? " each side" : ""}`).join("; ") || "No completed entries";
}
export function plannedLabel(exercise: SessionExercise, units: Units) {
  const target = exercise.planned;
  if (!target) return "No planned targets — added during logging";
  const tracking = exercise.definition.tracking;
  const quantity = ["duration", "cardio"].includes(tracking) ? target.seconds === null ? "Duration not set" : durationLabel(target.seconds) : target.repRange ? `${target.repRange.join("–")} reps` : target.reps === null ? "Repetitions not set" : `${target.reps} reps`;
  return `${tracking === "cardio" ? "" : `${target.sets} sets · `}${quantity}${exercise.definition.perSide ? " each side" : ""}${target.perSetLoadsKg ? ` · planned set loads: ${target.perSetLoadsKg.map(load => load === null ? "unknown" : `${decimalLabel(weightDisplay(load, units))} ${units.weight}`).join(" / ")}` : target.loadKg === null ? "" : ` · ${tracking === "assistance-reps" ? "assistance " : ""}${decimalLabel(weightDisplay(target.loadKg, units))} ${units.weight}`}${target.distanceKm === null ? "" : ` · ${decimalLabel(distanceDisplay(target.distanceKm, units))} ${units.distance}`}`;
}
export default function ExerciseLogFields({
  exercise,
  units,
  disabled,
  onChange,
  onRemoveSet
}: {
  exercise: SessionExercise;
  units: Units;
  disabled: boolean;
  onChange: (exercise: SessionExercise) => void;
  onRemoveSet: (id: string) => void;
}) {
  const tracking = exercise.definition.tracking;
  const patchSet = (id: string, patch: Partial<StrengthSet>) => onChange({
    ...exercise,
    sets: exercise.sets.map(set => {
      if (set.id !== id) return set;
      const next = {
        ...set,
        ...patch
      };
      next.completed = validSet(exercise, next);
      return next;
    })
  });
  if (tracking === "cardio" && exercise.cardio) {
    const cardio = exercise.cardio,
      average = speed(cardio.seconds, cardio.distanceKm);
    const patch = (change: Partial<typeof cardio>) => {
      const next = {
        ...cardio,
        ...change
      };
      next.completed = validCardioLog(next);
      onChange({
        ...exercise,
        cardio: next
      });
    };
    return <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Activity: {exercise.definition.activity}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Actual duration (minutes)" value={cardio.seconds === null ? null : cardio.seconds / 60} disabled={disabled} onChange={value => patch({
          seconds: value === null ? null : value * 60
        })} />
        <NumberField label={`Actual distance (${units.distance}, optional)`} value={cardio.distanceKm === null ? null : distanceDisplay(cardio.distanceKm, units)} disabled={disabled} onChange={value => patch({
          distanceKm: value === null ? null : distanceStore(value, units)
        })} />
      </div>
      <p className="text-xs text-muted-foreground">Leave distance empty when unknown.{average !== null && ` Average speed: ${decimalLabel(distanceDisplay(average, units))} ${units.distance}/h.`}</p>
      <Notes label="Cardio notes (optional)" value={cardio.notes} disabled={disabled} onChange={event => patch({
        notes: event.target.value
      })} />
      <p className="text-sm text-muted-foreground">{validCardioLog(cardio) ? "Ready · Finish workout confirms this cardio entry." : "Enter a positive duration to record this entry."}</p>
    </div>;
  }
  return <div className="space-y-3">{exercise.sets.map((set, index) => <GymReveal key={set.id}><fieldset className="rounded-2xl border border-border p-3" disabled={disabled}>
      <legend className="px-2 text-sm font-semibold">{set.warmup ? "Warm-up" : "Actual working"} set {index + 1}{exercise.definition.perSide ? " · each side" : ""}</legend>
      <div className="grid grid-cols-2 gap-3">{["weight-reps", "assistance-reps"].includes(tracking) && <NumberField label={`${tracking === "assistance-reps" ? "Assistance" : "Load"} (${units.weight})`} value={set.loadKg === null ? null : weightDisplay(set.loadKg, units)} onChange={value => patchSet(set.id, {
          loadKg: value === null ? null : weightStore(value, units)
        })} />}{tracking === "duration" ? <NumberField label="Duration (seconds)" value={set.seconds} onChange={seconds => patchSet(set.id, {
          seconds
        })} /> : <NumberField label="Repetitions" step={1} min={1} value={set.reps} onChange={reps => patchSet(set.id, {
          reps
        })} />}</div>
      <div className="my-3 flex flex-wrap items-center gap-2">
        <p className="flex min-h-11 flex-1 items-center text-xs text-muted-foreground">{validSet(exercise, set) ? "Ready · recorded with your workout" : tracking === "duration" ? "Enter a positive duration" : ["weight-reps", "assistance-reps"].includes(tracking) ? "Enter load and repetitions" : "Enter repetitions"}</p>
        <GymButton aria-label={`Duplicate set ${index + 1}`} disabled={exercise.sets.length >= 50} onClick={() => onChange({
          ...exercise,
          sets: [...exercise.sets, {
            ...set,
            id: crypto.randomUUID(),
            completed: false
          }]
        })}>
          <Copy />
        </GymButton>
        <GymButton aria-label={`Remove set ${index + 1}`} onClick={() => onRemoveSet(set.id)}>
          <Trash2 />
        </GymButton>
      </div>
      <Notes label={`Set ${index + 1} notes (optional)`} value={set.notes} onChange={event => patchSet(set.id, {
        notes: event.target.value
      })} />
      <details className="mt-2"><summary className="cursor-pointer text-sm text-muted-foreground">Effort / preparation (optional)</summary><div className="mt-3 space-y-2">
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" aria-label={`Warm-up status for set ${index + 1}`} className="size-5 accent-[var(--gym-blue)]" checked={set.warmup || false} onChange={event => patchSet(set.id, {warmup: event.target.checked})} />Warm-up set · excluded from working-set totals</label>
        {tracking !== "duration" && <NumberField label="Repetitions left in reserve (blank = not sure)" min={0} max={10} value={set.rir ?? null} onChange={rir => patchSet(set.id, {rir})} />}
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" aria-label={`Controlled technique for set ${index + 1}`} className="size-5 accent-[var(--gym-blue)]" checked={set.controlled || false} onChange={event => patchSet(set.id, {controlled: event.target.checked})} />I used controlled technique</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" aria-label={`Pain or discomfort for set ${index + 1}`} className="size-5 accent-[var(--gym-orange)]" checked={set.pain || false} onChange={event => patchSet(set.id, {pain: event.target.checked})} />Pain or discomfort occurred</label>
        {set.pain && <p className="text-xs text-muted-foreground">Stop this movement and seek qualified advice. The app cannot diagnose symptoms or approve continuing.</p>}
      </div></details>
    </fieldset></GymReveal>)}{!disabled && <GymButton disabled={exercise.sets.length >= 50} onClick={() => onChange({
      ...exercise,
      sets: [...exercise.sets, blankSet()]
    })}>
      <Plus />Add set</GymButton>}{!disabled && <GymButton disabled={exercise.sets.length >= 50} onClick={() => onChange({...exercise, sets: [...exercise.sets, {...blankSet(), warmup: true}]})}><Plus />Add warm-up set</GymButton>}</div>;
}
