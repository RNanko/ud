import { z } from "zod";
import { eventSchema, boardSchema } from "../events";
import { timezoneSchema } from "../gym/validation";
import { timingSchema } from "../planner-time";
const date = z.iso.date();
const manual = eventSchema.refine(event => event.kind !== "training" && !event.workout, "Use Gym for linked workouts");
export const eventCommandSchema = z.discriminatedUnion("kind", [
 z.object({kind:z.literal("upsert"),anchor:date,sourceDate:date.nullable(),date,event:manual}).strict(),
 z.object({kind:z.literal("complete"),anchor:date,date,id:z.string().min(1).max(150),completed:z.boolean()}).strict(),
 z.object({kind:z.literal("save-event-preset"),anchor:date,event:manual}).strict(),
 z.object({kind:z.literal("apply-event-preset"),anchor:date,date,preset:manual,eventId:z.uuid()}).strict(),
 z.object({kind:z.literal("save-week-preset"),anchor:date,id:z.uuid(),name:z.string().trim().min(1).max(80)}).strict(),
 z.object({kind:z.literal("apply-week-preset"),anchor:date,id:z.string().min(1).max(150),board:boardSchema,weekStart:z.enum(["monday","sunday"]),timezone:timezoneSchema}).strict(),
 z.object({kind:z.literal("reschedule-workout"),anchor:date,id:z.uuid(),revision:z.number().int().nonnegative(),date,timezone:timezoneSchema,timing:timingSchema}).strict(),
]);
export const eventWriteSchema=z.object({operationId:z.uuid(),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),data:eventCommandSchema}).strict();
export type EventCommand = z.infer<typeof eventCommandSchema>;
