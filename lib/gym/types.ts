export const categories = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Cardio"] as const;
export const equipmentTypes = ["Barbell", "Dumbbells", "Cable", "Machine", "Bodyweight", "Treadmill", "Stationary bike", "Outdoor bike", "Rowing machine", "Elliptical"] as const;
export const trackingTypes = ["weight-reps", "reps", "assistance-reps", "duration", "cardio"] as const;
export const iconKeys = ["barbell", "dumbbells", "bench-press", "chest-press", "cable", "lat-pulldown", "seated-row", "squat-rack", "leg-press", "leg-extension", "leg-curl", "shoulder-press", "treadmill", "stationary-bike", "outdoor-bike", "rowing", "elliptical", "bodyweight", "core"] as const;
export type Category = typeof categories[number];
export type TrackingType = typeof trackingTypes[number];
export type IconKey = typeof iconKeys[number];
export type ExerciseDefinition = {
  id: string;
  name: string;
  category: Category;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: typeof equipmentTypes[number];
  tracking: TrackingType;
  loadConvention: "total external load" | "per dumbbell" | "machine-displayed load" | "assistance" | "none";
  icon: IconKey;
  description: string;
  alternatives: string[];
  activity: string | null;
};
export type Targets = {
  sets: number;
  reps: number | null;
  loadKg: number | null;
  seconds: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
};
export type WorkoutExercise = {
  id: string;
  definition: ExerciseDefinition;
  targets: Targets;
  notes: string;
};
export type Blueprint = {
  timing?: import("../planner-time").EventTiming;
  name: string;
  notes: string;
  estimatedMinutes: number | null;
  exercises: WorkoutExercise[];
};
export type StrengthSet = {
  id: string;
  loadKg: number | null;
  reps: number | null;
  seconds: number | null;
  completed: boolean;
  notes: string;
};
export type CardioLog = {
  seconds: number | null;
  distanceKm: number | null;
  completed: boolean;
  notes: string;
};
export type SessionExercise = {
  id: string;
  definition: ExerciseDefinition;
  planned: Targets | null;
  notes: string;
  skipped: boolean;
  sets: StrengthSet[];
  cardio: CardioLog | null;
};
export type SessionData = {
  name: string;
  notes: string;
  date: string;
  timezone: string;
  status: "active" | "completed";
  completionMode?: "detailed" | "confirmation";
  logged: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  restUntil: string | null;
  originalPlan: Blueprint | null;
  exercises: SessionExercise[];
};
export type GymRecord<T> = {
  id: string;
  data: T;
  revision: number;
};
export type TemplateRecord = GymRecord<Blueprint>;
export type PlanRecord = GymRecord<Blueprint> & {
  date: string;
  timezone: string;
};
export type SessionRecord = GymRecord<SessionData> & {
  planId: string | null;
};
export type GymData = {
  templates: TemplateRecord[];
  plans: PlanRecord[];
  sessions: SessionRecord[];
  customExercises: GymRecord<ExerciseDefinition>[];
  restDays: string[];
};
export type Units = {
  weight: "kg" | "lb";
  distance: "km" | "mi";
};
export type SaveState = "saved" | "saving" | "failed";
