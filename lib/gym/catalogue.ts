import assets from "./catalogue-assets.json";
import { exerciseLibrary } from "./library";
import type { Category, ExerciseDefinition, IconKey } from "./types";

export const catalogueAssets = assets;
export const catalogueById = new Map(assets.map(asset => [asset.id, asset]));
// Exact variant aliases only. Ambiguous legacy treadmill, leg press, curl and cycling
// definitions retain their old IDs/history and are not silently reinterpreted.
export const canonicalAliases: Readonly<Record<string, string>> = {
  barbell_bench_press: "bench-press", incline_dumbbell_press: "incline-dumbbell-press",
  machine_chest_press: "chest-press", cable_chest_fly: "cable-fly",
  lat_pulldown: "lat-pulldown", seated_cable_row: "seated-row",
  one_arm_dumbbell_row: "dumbbell-row", barbell_back_squat: "squat",
  leg_extension: "leg-extension", machine_shoulder_press: "shoulder-press",
  dumbbell_lateral_raise: "lateral-raise", dumbbell_curl: "biceps-curl",
  push_up: "push-up", pull_up: "pull-up", assisted_pull_up: "assisted-pull-up",
  forearm_plank: "plank", elliptical_training: "elliptical",
};
const families = [
  ["machine_chest_press", "dumbbell_bench_press", "barbell_bench_press"],
  ["machine_incline_press", "incline_dumbbell_press"],
  ["seated_cable_row", "chest_supported_machine_row", "chest_supported_dumbbell_row"],
  ["lat_pulldown", "machine_lat_pulldown", "assisted_pull_up"],
  ["horizontal_leg_press_exercise", "leg_press_45_exercise", "dumbbell_goblet_squat"],
  ["dumbbell_romanian_deadlift", "romanian_deadlift"],
  ["seated_leg_curl", "lying_leg_curl"],
  ["pec_deck_fly", "machine_handle_fly", "cable_chest_fly"],
  ["dumbbell_reverse_lunge", "reverse_lunge"],
  ["treadmill_walking", "incline_treadmill_walking"],
  ["upright_bike_cycling", "recumbent_bike_cycling", "indoor_cycle_seated"],
];
const groups: [Category, string[]][] = [
  ["Chest", ["dumbbell_bench_press", "barbell_bench_press", "machine_chest_press", "machine_incline_press", "incline_dumbbell_press", "pec_deck_fly", "machine_handle_fly", "cable_chest_fly", "dumbbell_floor_press", "push_up"]],
  ["Back", ["lat_pulldown", "machine_lat_pulldown", "assisted_pull_up", "pull_up", "seated_cable_row", "chest_supported_machine_row", "chest_supported_dumbbell_row", "one_arm_dumbbell_row", "straight_arm_pulldown"]],
  ["Shoulders", ["machine_shoulder_press", "dumbbell_lateral_raise", "reverse_pec_deck"]],
  ["Arms", ["rope_triceps_pushdown", "rope_overhead_extension", "dumbbell_curl", "hammer_curl", "ez_bar_curl"]],
  ["Legs", ["horizontal_leg_press_exercise", "leg_press_45_exercise", "dumbbell_goblet_squat", "dumbbell_romanian_deadlift", "romanian_deadlift", "barbell_back_squat", "seated_leg_curl", "lying_leg_curl", "dumbbell_reverse_lunge", "reverse_lunge", "leg_extension", "machine_standing_calf_raise", "standing_calf_raise", "seated_calf_raise", "machine_hip_thrust"]],
  ["Core", ["dead_bug", "forearm_plank", "side_plank", "machine_ab_crunch"]],
  ["Cardio", ["treadmill_walking", "treadmill_running", "incline_treadmill_walking", "upright_bike_cycling", "recumbent_bike_cycling", "indoor_cycle_seated", "elliptical_training", "air_rowing"]],
];
export const canonicalId = (slug: string) => canonicalAliases[slug] || `exercise:${slug}`;
function definition(slug: string, category: Category): ExerciseDefinition {
  const asset = catalogueById.get(`exercise:${slug}`);
  if (!asset || asset.type !== "exercise") throw new Error(`Unresolved exercise: ${slug}`);
  const tracking = ({ weight_reps: "weight-reps", bodyweight_reps: "reps", assisted_reps: "assistance-reps", duration: "duration", cardio: "cardio" } as Record<string, ExerciseDefinition["tracking"]>)[asset.tracking || ""];
  if (!tracking) throw new Error(`Unsupported tracking for ${slug}: ${asset.tracking}`);
  const hardware = asset.equipmentIds.join(" ");
  const equipment: ExerciseDefinition["equipment"] = tracking === "duration" || tracking === "reps" ? "Bodyweight"
    : category === "Cardio" ? slug.includes("bike") || slug === "indoor_cycle_seated" ? "Stationary bike" : slug.includes("treadmill") ? "Treadmill" : slug === "air_rowing" ? "Rowing machine" : "Elliptical"
    : hardware.includes("dumbbell") ? "Dumbbells" : hardware.includes("barbell") || hardware.includes("ez_bar") || slug === "romanian_deadlift" ? "Barbell"
    : hardware.includes("cable") || hardware.includes("pulldown_station") || hardware.includes("low_row_station") ? "Cable" : "Machine";
  const loadConvention: ExerciseDefinition["loadConvention"] = tracking === "assistance-reps" ? "assistance"
    : tracking !== "weight-reps" ? "none" : equipment === "Dumbbells" ? "per dumbbell"
    : equipment === "Barbell" ? "total external load" : ["leg_press_45_exercise", "seated_calf_raise"].includes(slug) ? "added plates" : "machine-displayed load";
  const icon: IconKey = category === "Cardio" ? equipment === "Stationary bike" ? "stationary-bike" : equipment === "Rowing machine" ? "rowing" : equipment === "Treadmill" ? "treadmill" : "elliptical"
    : category === "Core" ? "core" : equipment === "Dumbbells" ? "dumbbells" : equipment === "Barbell" ? "barbell" : equipment === "Bodyweight" ? "bodyweight"
    : category === "Back" ? "seated-row" : category === "Legs" ? "leg-press" : category === "Shoulders" ? "shoulder-press" : category === "Arms" ? "cable" : "chest-press";
  return { id: canonicalId(slug), catalogueId: asset.id, equipmentIds: asset.equipmentIds, name: asset.name,
    category, equipment, tracking, icon, loadConvention, perSide: ["dead_bug", "side_plank", "one_arm_dumbbell_row", "dumbbell_reverse_lunge", "reverse_lunge"].includes(slug),
    primaryMuscles: [category], secondaryMuscles: category === "Chest" ? ["Triceps", "Front shoulders"] : category === "Back" ? ["Biceps"] : [],
    alternatives: (families.find(family => family.includes(slug)) || []).filter(id => id !== slug).map(canonicalId),
    activity: category === "Cardio" ? asset.name : null,
    description: "Unreviewed catalogue entry. Ask a qualified trainer to check setup, technique and suitability. This illustration identifies equipment or a movement; it does not demonstrate technique." };
}
export const presetExercises = groups.flatMap(([category, slugs]) => slugs.map(slug => definition(slug, category)));
export const gymExercises = [...exerciseLibrary.filter(existing => !presetExercises.some(item => item.id === existing.id)), ...presetExercises];
export function exerciseFor(slug: string) {
  const found = presetExercises.find(item => item.catalogueId === `exercise:${slug}`);
  if (!found) throw new Error(`Exercise ${slug} is not configured for presets`);
  return found;
}
export function equipmentFor(exercises: { definition: ExerciseDefinition }[]) {
  return [...new Set(exercises.flatMap(item => item.definition.equipmentIds || []))].map(id => catalogueById.get(id)).filter((item): item is typeof assets[number] => !!item);
}
