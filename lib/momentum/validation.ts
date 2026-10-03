import z from "zod";
import { calendarDay, recordId, timezoneSchema } from "../gym/validation";
import { areas, currencies } from "./types";
import { goalCommands } from "./goals/validation";
const text = z.string().trim().max(3000), title = z.string().trim().min(1).max(200), minor = z.number().int().min(0).max(1e12), minutes = z.number().int().min(1).max(240);
export const sourceSchema = z.object({ kind: z.enum(["task", "workout", "event"]), id: z.string().min(1).max(150), week: z.string().regex(/^\d{4}-WK\d{1,2}$/).optional() }).strict().refine(ref => ref.kind !== "event" || !!ref.week, "Choose an event occurrence");
export const selectionSchema = z.object({ source: sourceSchema, why: text, minutes: minutes.nullable(), journeyId: recordId.nullable() }).strict();
export const chapterSchema = z.object({ id: recordId, title, criterion: title, links: z.array(sourceSchema).max(20), confirmedAt: z.iso.datetime().nullable() }).strict();
export const journeySchema = z.object({ id: recordId, title, area: z.enum(areas), kind: z.enum(["project", "recurring", "learning", "money"]), reason: text, outcome: text, nextAction: text, targetDate: calendarDay.nullable(), target: text, status: z.enum(["active", "paused", "archived"]), priority: z.enum(["primary", "secondary", "later"]), template: z.object({ key: z.string().max(50), version: z.number().int().positive() }).nullable(), chapters: z.array(chapterSchema).min(1).max(30) }).strict();
export const entrySchema = z.object({ id: recordId, allocationRef: z.string().trim().min(1, "Name the unique allocation reference").max(100), date: calendarDay, type: z.enum(["contribution", "withdrawal"]), amountMinor: minor.refine(value => value > 0, "Enter an amount greater than zero"), note: text }).strict();
export const savingsSchema = z.object({ id: recordId, name: title, currency: z.enum(currencies), targetMinor: minor.refine(value => value > 0, "Enter a positive target"), targetDate: calendarDay.nullable(), openingMinor: minor, openingDate: calendarDay, entries: z.array(entrySchema).max(1000) }).strict();
export const commandSchema = z.discriminatedUnion("type", [
  ...goalCommands,
  z.object({ type: z.literal("preferences"), value: z.object({ thoughts: z.boolean(), money: z.boolean(), statistics: z.boolean(), rewards: z.boolean() }).strict() }).strict(),
  z.object({ type: z.literal("select"), slot: z.enum(["main", "supporting"]), selection: selectionSchema.nullable(), removeKey: z.string().max(300).optional() }).strict(),
  z.object({ type: z.literal("thought"), action: z.enum(["save", "unsave", "dismiss"]), index: z.number().int().min(0).max(11) }).strict(),
  z.object({ type: z.literal("journey"), value: journeySchema }).strict(),
  z.object({ type: z.literal("delete-journey"), id: recordId }).strict(),
  z.object({ type: z.literal("chapter"), journeyId: recordId, chapterId: recordId, confirm: z.boolean().optional(), links: z.array(sourceSchema).max(20).optional() }).strict(),
  z.object({ type: z.literal("focus-start"), id: recordId, source: sourceSchema.nullable(), minutes }).strict(),
  z.object({ type: z.literal("focus-control"), id: recordId, action: z.enum(["pause", "resume", "finish", "discard", "extend"]), minutes: minutes.optional() }).strict(),
  z.object({ type: z.literal("focus-save"), id: recordId, seconds: z.number().int().min(0).max(86400), notes: text }).strict(),
  z.object({ type: z.literal("review"), id: recordId, week: calendarDay, worthwhile: text, obstacle: text, change: text, manageable: z.enum(["", "Manageable", "Needs adjustment", "Not sure"]), draft: z.boolean(), refreshSummary: z.boolean() }).strict(),
  z.object({ type: z.literal("savings"), value: savingsSchema }).strict(),
  z.object({ type: z.literal("delete-savings"), id: recordId }).strict(),
  z.object({ type: z.literal("entry"), goalId: recordId, value: entrySchema }).strict(),
  z.object({ type: z.literal("delete-entry"), goalId: recordId, id: recordId }).strict(),
  z.object({ type: z.literal("adjustment"), id: recordId, kind: z.enum(["smaller-step", "rest", "rescheduled"]) }).strict(),
  z.object({ type: z.literal("rest"), value: z.boolean() }).strict(),
  z.object({ type: z.literal("delete-all") }).strict()
]);
export type MomentumCommand = z.infer<typeof commandSchema>;
export const requestSchema = z.object({ revision: z.number().int().nonnegative(), mutationId: recordId, timezone: timezoneSchema, command: commandSchema }).strict();

// Bound collection sizes and enforce unique stable identifiers before persistence.
export function validateCollections(data: import("./types").MomentumData) {
  if (data.tracker && (data.tracker.goals.length > 50 || data.tracker.scopes.length > 100 || data.tracker.records.length > 5000 || data.tracker.history.length > 10000 || data.tracker.reminders.length > 10000)) throw new Error("Choose an export and remove older tracker records before adding more history");
  if (data.tracker) for (const collection of [data.tracker.goals, data.tracker.scopes, data.tracker.records]) if (new Set(collection.map(x => x.id)).size !== collection.length) throw new Error("Choose unique tracker record identifiers");
  const collections = [data.journeys, data.focus, data.reviews, data.savings];
  if (data.journeys.length > 100 || data.focus.length > 5000 || data.reviews.length > 1000 || data.savings.length > 100) throw new Error("Choose fewer records or export older Momentum records first");
  if (data.days.length > 3660 || data.awards.length > 10000 || data.adjustments.length > 10000) throw new Error("Choose an export and clear older Momentum records before adding more history");
  for (const collection of collections) if (new Set(collection.map(item => item.id)).size !== collection.length) throw new Error("Choose unique record identifiers");
  const chapters = data.journeys.flatMap(item => item.chapters), entries = data.savings.flatMap(item => item.entries);
  for (const collection of [chapters, entries]) if (new Set(collection.map(item => item.id)).size !== collection.length) throw new Error("Choose unique allocations and chapter identifiers");
  for (const journey of data.journeys) for (const chapter of journey.chapters) {
    const keys = chapter.links.map(ref => `${ref.kind}:${ref.week ?? ""}:${ref.id}`);
    if (new Set(keys).size !== keys.length) throw new Error("Choose each source only once in a chapter");
  }
  if (data.focus.filter(item => ["running", "paused", "awaiting"].includes(item.status)).length > 1) throw new Error("Finish or discard the current focus session first");
}
