import type { SessionData } from "./types";

/** Defaults/targets are not actual results. Partial input and personal edits are. */
export function hasRecordedWorkoutDetails(session: SessionData) {
  if (session.notes.trim() !== (session.originalPlan?.notes ?? "").trim()) return true;
  return session.exercises.some(exercise => {
    const original = session.originalPlan?.exercises.find(e => e.id === exercise.id);
    if (!original || original.definition.id !== exercise.definition.id || exercise.skipped || exercise.notes.trim() !== original.notes.trim()) return true;
    if (exercise.cardio && (exercise.cardio.completed || exercise.cardio.seconds !== null || exercise.cardio.distanceKm !== null || exercise.cardio.notes.trim())) return true;
    return exercise.sets.some(set => set.completed || set.loadKg !== null || set.reps !== null || set.seconds !== null || set.notes.trim() || set.rir != null || set.pain || set.controlled || set.warmup);
  }) || session.exercises.length !== session.originalPlan?.exercises.length;
}
