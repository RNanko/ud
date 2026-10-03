import assets from "./catalogue-assets.json";
import type { Category, IconKey } from "./types";

const available = new Map(assets.map(asset => [asset.id, asset.icon]));

// Presentation only. Generic legacy records use equipment artwork where their
// exact movement variant is unknown; their IDs, measurements and history stay intact.
export const exerciseArtworkIds: Readonly<Record<string, string | null>> = {
  "bench-press": "exercise:barbell_bench_press",
  "incline-dumbbell-press": "exercise:incline_dumbbell_press",
  "chest-press": "exercise:machine_chest_press",
  "cable-fly": "exercise:cable_chest_fly",
  "lat-pulldown": "exercise:lat_pulldown",
  "seated-row": "exercise:seated_cable_row",
  "dumbbell-row": "exercise:one_arm_dumbbell_row",
  squat: "exercise:barbell_back_squat",
  "leg-press": "equipment:horizontal_leg_press",
  "leg-extension": "exercise:leg_extension",
  "leg-curl": "equipment:seated_leg_curl_machine",
  "calf-raise": "equipment:standing_calf_machine",
  "shoulder-press": "exercise:machine_shoulder_press",
  "lateral-raise": "exercise:dumbbell_lateral_raise",
  "biceps-curl": "exercise:dumbbell_curl",
  "triceps-pushdown": "equipment:adjustable_cable",
  "push-up": "exercise:push_up",
  "pull-up": "exercise:pull_up",
  "assisted-pull-up": "exercise:assisted_pull_up",
  plank: "exercise:forearm_plank", crunch: "exercise:crunch",
  treadmill: "equipment:treadmill", "stationary-cycling": "equipment:upright_bike",
  "outdoor-cycling": null, rowing: "equipment:air_rower", elliptical: "exercise:elliptical_training",
};

export const exerciseIconIds: Record<IconKey, string | null> = {
  barbell: "equipment:barbell", dumbbells: "equipment:dumbbell",
  "bench-press": "equipment:olympic_bench", "chest-press": "equipment:chest_press_machine",
  cable: "equipment:adjustable_cable", "lat-pulldown": "equipment:lat_pulldown_station",
  "seated-row": "equipment:low_row_station", "squat-rack": "equipment:squat_rack",
  "leg-press": "equipment:horizontal_leg_press", "leg-extension": "equipment:leg_extension_machine",
  "leg-curl": "equipment:seated_leg_curl_machine", "shoulder-press": "equipment:shoulder_press_machine",
  treadmill: "equipment:treadmill", "stationary-bike": "equipment:upright_bike",
  "outdoor-bike": null, rowing: "equipment:air_rower", elliptical: "equipment:elliptical",
  bodyweight: "exercise:push_up", core: "exercise:forearm_plank",
};

export const categoryIconIds: Record<Category, string> = {
  Legs: "exercise:horizontal_leg_press_exercise", Chest: "exercise:dumbbell_bench_press",
  Back: "exercise:seated_cable_row", Shoulders: "exercise:dumbbell_lateral_raise",
  Arms: "exercise:dumbbell_curl", Core: "exercise:forearm_plank", Cardio: "exercise:treadmill_walking",
};

export function resolveExerciseIconId(exerciseId?: string, icon?: IconKey): string | null {
  if (exerciseId?.startsWith("exercise:") || exerciseId?.startsWith("equipment:")) return available.has(exerciseId) ? exerciseId : null;
  const id = exerciseId && Object.hasOwn(exerciseArtworkIds, exerciseId) ? exerciseArtworkIds[exerciseId] : icon ? exerciseIconIds[icon] : null;
  return id && available.has(id) ? id : null;
}

export const exerciseIcons = Object.fromEntries(Object.entries(exerciseIconIds).map(([key, id]) => [key, id ? available.get(id) || null : null])) as Record<IconKey, string | null>;
export const exerciseArtwork = Object.fromEntries(Object.entries(exerciseArtworkIds).map(([key, id]) => [key, id ? available.get(id) || null : null])) as Readonly<Record<string, string | null>>;
export const categoryIcons = Object.fromEntries(Object.entries(categoryIconIds).map(([key, id]) => [key, available.get(id)!])) as Record<Category, string>;
