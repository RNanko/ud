import z from "zod";
import { calendarDay, recordId, timezoneSchema } from "../../gym/validation";
import { currencies } from "../types";
import { goalMetrics, recordKinds } from "./types";
// Source keys are occurrences, not copied activity names or completion flags.
const ref = z.object({ kind: z.enum(["task", "event", "workout"]), id: z.string().min(1).max(150), week: z.string().regex(/^\d{4}-WK\d{1,2}$/).optional() }).strict().refine(x => x.kind !== "event" || !!x.week, "Choose an event occurrence");
export const ruleSchema = z.object({ metric: z.enum(goalMetrics), target: z.number().int().positive().max(1e12), currency: z.enum(currencies).nullable(), period: z.enum(["ongoing", "weekly", "monthly", "range"]), start: calendarDay, end: calendarDay.nullable(), timezone: timezoneSchema, weekStartsOn:z.enum(["monday","sunday"]).optional(), scopeId: recordId.nullable(), sources: z.array(ref).max(50), journeyId: recordId.nullable(), throughout: z.boolean(), freshnessDays: z.number().int().min(1).max(365) }).strict().superRefine((rule, ctx) => {
  const money = ["balance", "savings", "investment"].includes(rule.metric);
  if (money !== !!rule.currency) ctx.addIssue({ code: "custom", message: "Choose the currency for this money rule", path: ["currency"] });
  if (rule.period === "range" && (!rule.end || rule.end < rule.start)) ctx.addIssue({ code: "custom", message: "Choose an end date on or after the start", path: ["end"] });
  if (rule.end && rule.end < rule.start) ctx.addIssue({ code: "custom", message: "Choose a valid date range", path: ["end"] });
  if (rule.metric === "balance" && !["ongoing", "monthly", "range"].includes(rule.period)) ctx.addIssue({ code: "custom", message: "Choose ongoing, monthly, or a date range for a balance", path: ["period"] });
  if (["balance", "savings", "investment", "visits"].includes(rule.metric) && !rule.scopeId) ctx.addIssue({ code: "custom", message: "Choose an explicit record scope", path: ["scopeId"] });
  if (rule.metric === "minutes" && !rule.scopeId && !rule.sources.length && !rule.journeyId) ctx.addIssue({ code: "custom", message: "Choose the activity, task or journey whose time counts", path: ["sources"] });
  if (rule.throughout && rule.metric !== "balance") ctx.addIssue({ code: "custom", message: "Only balance rules support a throughout-period condition" });
});
export const reminderSchema = z.object({ enabled: z.boolean(), days: z.array(z.number().int().min(0).max(6)).max(7), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), leadDays: z.number().int().min(0).max(30).nullable() }).strict();
export const goalCommands = [
  z.object({ type: z.literal("goal-save"), id: recordId, name: z.string().trim().min(1).max(200), rule: ruleSchema.refine(rule=>rule.metric!=="investment"||rule.currency==="USD","Investments currently support USD only"), apply: z.enum(["current", "next"]), reminder: reminderSchema }).strict(),
  z.object({ type: z.literal("goal-card"), id: recordId, lifecycle: z.enum(["active", "paused", "archived"]).optional(), pinned: z.boolean().optional(), hidden: z.boolean().optional(), direction: z.enum(["up", "down"]).optional() }).strict(),
  z.object({ type: z.literal("goal-delete"), id: recordId }).strict(),
  z.object({ type: z.literal("goal-scope"), id: recordId, name: z.string().trim().min(1).max(100), kind: z.enum(["cash", "investment", "activity"]), currency: z.enum(currencies).nullable() }).strict().refine(scope=>scope.kind!=="investment"||scope.currency==="USD","Investments currently support USD only"),
  z.object({ type: z.literal("goal-record"), value: z.object({ id: recordId, scopeId: recordId, kind: z.enum(recordKinds), reference: z.string().trim().min(1).max(100), date: calendarDay, occurredAt: z.iso.datetime(), value: z.number().int().min(-1e12).max(1e12), note: z.string().trim().max(3000), linkedFocusId: recordId.nullable(), confirmedThrough: calendarDay.nullable() }).strict() }).strict(),
  z.object({ type: z.literal("goal-remove-record"), id: recordId }).strict(),
  z.object({ type: z.literal("goal-remove-scope"), id: recordId }).strict(),
  z.object({ type: z.literal("goal-reminder"), id: recordId, key: z.string().min(1).max(300), action: z.enum(["dismiss", "snooze"]), until: z.iso.datetime().nullable() }).strict(),
  z.object({ type: z.literal("goal-hide-amounts"), value: z.boolean() }).strict()
] as const;
