"use client";

import { Check, Info, Plus } from "lucide-react";
import type { ExerciseDefinition } from "@/lib/gym/types";
import ExerciseIcon from "./ExerciseIcon";
import { GymButton } from "./GymUI";

export const trackingLabels = {
  "weight-reps": "Weight + repetitions",
  reps: "Repetitions only",
  "assistance-reps": "Assistance + repetitions",
  duration: "Duration only",
  cardio: "Duration + optional distance"
};

export default function ExerciseCard({ exercise, selected, onToggle, onDetails }: {
  exercise: ExerciseDefinition;
  selected: boolean;
  onToggle: () => void;
  onDetails: () => void;
}) {
  return <article className="gym-exercise-card" data-selected={selected}>
    <div className="gym-exercise-card-top">
      <div className="gym-art-stage">
        <ExerciseIcon icon={exercise.icon} exerciseId={exercise.id} size={112} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <span className="gym-category-tag">{exercise.category}</span>
        <h3 className="text-base font-semibold leading-snug text-foreground">{exercise.name}</h3>
        <p className="text-sm text-muted-foreground">{exercise.equipment}</p>
      </div>
    </div>
    <p className="gym-tracking-label">{trackingLabels[exercise.tracking]}</p>
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <GymButton tone={selected ? "blue" : "neutral"} aria-label={`${selected ? "Remove" : "Add"} ${exercise.name}`} aria-pressed={selected} onClick={onToggle}>
        {selected ? <Check /> : <Plus />}{selected ? "Selected" : "Add to workout"}
      </GymButton>
      <GymButton aria-label={`About ${exercise.name}`} onClick={onDetails} className="px-3"><Info /></GymButton>
    </div>
  </article>;
}
