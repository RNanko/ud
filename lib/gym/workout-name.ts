import type { ExerciseDefinition } from "./types";

/** Use explicit primary categories and muscles, never exercise-name substring guesses. */
export function suggestWorkoutName(exercises: readonly ExerciseDefinition[]) {
  const groups = new Set<string>();
  for (const exercise of exercises) {
    if (exercise.category !== "Arms") { groups.add(exercise.category); continue; }
    const armGroups = exercise.primaryMuscles.map(muscle => muscle.toLowerCase().trim()).filter(muscle => muscle === "biceps" || muscle === "triceps");
    if (!armGroups.length) groups.add("Arms");
    for (const group of armGroups) groups.add(group === "biceps" ? "Biceps" : "Triceps");
  }
  if (!groups.size) return "";
  const upper = ["Chest", "Back", "Shoulders", "Arms", "Biceps", "Triceps"].filter(group => groups.has(group));
  if (groups.has("Legs") && upper.length >= 2) return groups.has("Cardio") ? "Full body / Cardio day" : "Full body day";
  return ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Arms", "Legs", "Core", "Cardio"].filter(group => groups.has(group)).join(" / ") + " day";
}
