import z from "zod";
import { categories, equipmentTypes, iconKeys, trackingTypes } from "./types";
import { dateInZone } from "./dates";
import { timingSchema } from "../planner-time";
export const recordId = z.uuid();
export const calendarDay = z.iso.date().refine(value => value >= "1900-01-01" && value <= "2200-12-31", "Choose a date between 1900 and 2200");
export const timezoneSchema = z.string().max(100).refine(value => {
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: value
    });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid timezone");
const count = (max: number) => z.number().finite().int().min(1).max(max);
const measure = (max: number) => z.number().finite().min(0).max(max).nullable();
const text = z.string().trim().max(3000);
export const definitionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  category: z.enum(categories),
  equipment: z.enum(equipmentTypes),
  tracking: z.enum(trackingTypes),
  loadConvention: z.enum(["total external load", "per dumbbell", "machine-displayed load", "assistance", "none"]),
  icon: z.enum(iconKeys),
  primaryMuscles: z.array(z.string().max(80)).max(10),
  secondaryMuscles: z.array(z.string().max(80)).max(10),
  description: z.string().max(1000),
  alternatives: z.array(z.string().max(100)).max(15),
  activity: z.string().min(1).max(80).nullable()
}).strict().superRefine((data, context) => {
  if (data.tracking === "assistance-reps" && data.loadConvention !== "assistance" || ["reps", "duration", "cardio"].includes(data.tracking) && data.loadConvention !== "none" || data.tracking === "weight-reps" && ["none", "assistance"].includes(data.loadConvention)) context.addIssue({
    code: "custom",
    message: "Tracking type and load convention must agree"
  });
  if (data.tracking === "cardio" && !data.activity) context.addIssue({
    code: "custom",
    message: "Cardio needs an activity type"
  });
});
export const targetsSchema = z.object({
  sets: count(30),
  reps: count(10000).nullable(),
  loadKg: measure(5000),
  seconds: measure(604800),
  distanceKm: measure(10000),
  restSeconds: measure(3600)
}).strict();
export const blueprintSchema = z.object({
  timing: timingSchema.optional(),
  name: z.string().trim().min(1, "Name your workout").max(120),
  notes: text,
  estimatedMinutes: measure(1440),
  exercises: z.array(z.object({
    id: recordId,
    definition: definitionSchema,
    targets: targetsSchema,
    notes: text
  }).strict()).min(1, "Choose at least one exercise").max(40)
}).strict().superRefine((data, context) => {
  if (new Set(data.exercises.map(item => item.id)).size !== data.exercises.length) context.addIssue({
    code: "custom",
    message: "Exercise instance IDs must be unique"
  });
  for (const exercise of data.exercises) {
    if (["weight-reps", "reps", "assistance-reps"].includes(exercise.definition.tracking) && !exercise.targets.reps) context.addIssue({
      code: "custom",
      message: `Enter target repetitions for ${exercise.definition.name}`
    });
    if (["duration", "cardio"].includes(exercise.definition.tracking) && !(exercise.targets.seconds && exercise.targets.seconds > 0)) context.addIssue({
      code: "custom",
      message: `Enter a duration target for ${exercise.definition.name}`
    });
  }
});
const setSchema = z.object({
  id: recordId,
  loadKg: measure(5000),
  reps: count(10000).nullable(),
  seconds: measure(604800),
  completed: z.boolean(),
  notes: text
}).strict();
const cardioSchema = z.object({
  seconds: measure(604800),
  distanceKm: measure(10000),
  completed: z.boolean(),
  notes: text
}).strict();
export const sessionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: text,
  date: calendarDay,
  timezone: timezoneSchema,
  status: z.enum(["active", "completed"]),
  completionMode: z.enum(["detailed", "confirmation"]).optional(),
  logged: z.boolean(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  restUntil: z.iso.datetime().nullable(),
  originalPlan: blueprintSchema.nullable(),
  exercises: z.array(z.object({
    id: recordId,
    definition: definitionSchema,
    planned: targetsSchema.nullable(),
    notes: text,
    skipped: z.boolean(),
    sets: z.array(setSchema).max(50),
    cardio: cardioSchema.nullable()
  }).strict()).min(1).max(50)
}).strict().superRefine((data, context) => {
  if (data.date > dateInZone(new Date(), data.timezone)) context.addIssue({
    code: "custom",
    message: "Actual workouts cannot be recorded on a future date"
  });
  const ids = data.exercises.flatMap(exercise => [exercise.id, ...exercise.sets.map(set => set.id)]);
  if (new Set(ids).size !== ids.length) context.addIssue({
    code: "custom",
    message: "Exercise and set IDs must be unique"
  });
  let completed = 0;
  for (const exercise of data.exercises) {
    const tracking = exercise.definition.tracking;
    if (tracking === "cardio") {
      if (exercise.sets.length || !exercise.cardio) context.addIssue({
        code: "custom",
        message: "Cardio must use duration and optional distance fields"
      });
      if (exercise.cardio?.completed) {
        if (!(exercise.cardio.seconds && exercise.cardio.seconds > 0)) context.addIssue({
          code: "custom",
          message: `Enter a positive cardio duration for ${exercise.definition.name}`
        });else completed++;
      }
    } else {
      if (exercise.cardio) context.addIssue({
        code: "custom",
        message: "This exercise must use set fields"
      });
      for (const set of exercise.sets) if (set.completed) {
        if (tracking === "duration" ? !(set.seconds && set.seconds > 0) : !set.reps || ["weight-reps", "assistance-reps"].includes(tracking) && set.loadKg === null) context.addIssue({
          code: "custom",
          message: `Complete the required actual fields for ${exercise.definition.name}`
        });else completed++;
      }
    }
  }
  if (data.status === "completed" && ((!completed && data.completionMode !== "confirmation") || !data.finishedAt)) context.addIssue({
    code: "custom",
    message: "Record at least one completed set or cardio entry before finishing"
  });
});
