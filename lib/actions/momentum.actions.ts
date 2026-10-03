"use server";
import z from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "../db/drizzle";
import { kanbanBoard, momentumState, userEvents } from "../db/schema";
import { requireUserId } from "../session";
import { getGymData } from "./gym.actions";
import { getToDoList, updateToDoList } from "./todo.actions";
import { dateInZone } from "../gym/dates";
import { timezoneSchema } from "../gym/validation";
import { calendarDay } from "../gym/validation";
import { timingSchema } from "../planner-time";
import { emptyTodoBoard, moveTodoTask, type TodoBoard } from "../todo";
import { emptyMomentum, type MomentumRecord, type Sources } from "../momentum/types";
import { addAwards, assignThought, buildSummary, sourceActivities } from "../momentum/logic";
import { requestSchema, validateCollections } from "../momentum/validation";
import { sourceSchema } from "../momentum/validation";
import { scheduleConflicts } from "../momentum/scheduling";
import { reduceMomentum } from "../momentum/reducer";
import type { EventItems } from "@/types/types";
import { reconcileGoals } from "../momentum/goals/reconcile";
import { evaluateGoal, trackerFor } from "../momentum/goals/evaluate";
import { goalReview } from "../momentum/goals/review";
function summaryWithGoals(sources: Sources, activities: ReturnType<typeof sourceActivities>, data: import("../momentum/types").MomentumData, week: string, timezone: string, now: string) { return { ...buildSummary(sources, activities, data, week, timezone, now), goalResults: goalReview(data, { ...sources, activities }, week, timezone, now) }; }

async function readSources(owner: string): Promise<Sources> {
  const [todo, gym, weeks] = await Promise.all([getToDoList(), getGymData(), db.select({ week: userEvents.week, data: userEvents.data }).from(userEvents).where(eq(userEvents.userId, owner))]);
  return { todo: todo as TodoBoard, gym, weeks: weeks.filter(row => /^\d{4}-WK\d{1,2}$/.test(row.week)).map(row => ({ week: row.week, data: row.data as EventItems[] })) };
}
async function rowFor(owner: string) {
  await db.insert(momentumState).values({ userId: owner, data: emptyMomentum() }).onConflictDoNothing();
  const [row] = await db.select().from(momentumState).where(eq(momentumState.userId, owner));
  if (!row) throw new Error("Momentum could not be loaded");
  return row;
}
const record = (row: typeof momentumState.$inferSelect): MomentumRecord => ({ data: row.data, revision: row.revision });
function safeError(error: unknown) {
  return error instanceof z.ZodError ? error.issues[0].message : error instanceof Error && /^(Membership|Choose|Source|Finish|This focus|Confirm|Correct|Pause|Create|An allocation|Newer|Retry|Use|Enter)/.test(error.message) ? error.message : "Save failed — retry. Your entered details are still here.";
}
export async function getMomentumBundle(input: unknown) {
  const owner = await requireUserId(), { timezone, week } = z.object({ timezone: timezoneSchema, week: z.iso.date().optional() }).parse(input);
  const today = dateInZone(new Date(), timezone), sources = await readSources(owner), activities = sourceActivities(sources, timezone);
  let row = await rowFor(owner);
  for (let attempt = 0; attempt < 8; attempt++) {
    const data = reconcileGoals(addAwards(assignThought(row.data, today, owner), activities, new Date().toISOString()), { ...sources, activities }, new Date().toISOString());
    if (JSON.stringify(data) === JSON.stringify(row.data)) break;
    const [saved] = await db.update(momentumState).set({ data, revision: row.revision + 1, updatedAt: new Date() }).where(and(eq(momentumState.userId, owner), eq(momentumState.revision, row.revision))).returning();
    row = saved ?? await rowFor(owner);
  }
  return { record: record(row), activities, today, timezone, restDays: sources.gym.restDays, summary: summaryWithGoals(sources, activities, row.data, week ?? today, timezone, new Date().toISOString()), goalEvaluations: trackerFor(row.data).goals.map(goal => evaluateGoal(goal, row.data, { ...sources, activities }, new Date().toISOString())) };
}
export async function mutateMomentum(input: unknown) {
  try {
    const owner = await requireUserId(), payload = requestSchema.parse(input), row = await rowFor(owner);
    if (row.mutations.includes(payload.mutationId)) return { success: true as const, record: record(row), newAwards: [] as string[] };
    if (row.revision !== payload.revision) return { success: false as const, conflict: true, message: "Newer changes exist. Reload Momentum before saving again.", record: record(row) };
    const completion=payload.command.type==="focus-save" || payload.command.type==="focus-control" && ["finish","discard"].includes(payload.command.action) ? {kind:"focus" as const,id:payload.command.id}:undefined;
    await requireUserId(owner,"write",completion);
    const now = new Date().toISOString(), date = dateInZone(new Date(now), payload.timezone), sources = await readSources(owner), activities = sourceActivities(sources, payload.timezone);
    let data = reduceMomentum(row.data, payload.command, { date, timezone: payload.timezone, now, activities, summaryFor: week => summaryWithGoals(sources, activities, row.data, week, payload.timezone, now) });
    data = addAwards(data, activities, now);
    data = reconcileGoals(data, { ...sources, activities }, now);
    validateCollections(data);
    const [saved] = await db.update(momentumState).set({ data, revision: row.revision + 1, mutations: [...row.mutations, payload.mutationId].slice(-256), updatedAt: new Date(now) }).where(and(eq(momentumState.userId, owner), eq(momentumState.revision, payload.revision))).returning();
    if (!saved) {
      const latest = await rowFor(owner);
      if (latest.mutations.includes(payload.mutationId)) return { success: true as const, record: record(latest), newAwards: [] as string[] };
      return { success: false as const, conflict: true, message: "Newer changes exist. Reload Momentum before saving again.", record: record(latest) };
    }
    revalidatePath("/account/momentum");
    return { success: true as const, record: record(saved), newAwards: [...data.awards.filter(item => !row.data.awards.some(old => old.key === item.key)).map(item => item.key), ...trackerFor(data).attainments.filter(item => !trackerFor(row.data).attainments.some(old => old.key === item.key)).map(item => item.key)] };
  } catch (error) { const message = safeError(error); return { success: false as const, message, retryable: message.startsWith("Save failed") }; }
}

// Canonical task mutations use the same compare-and-swap writer as the To-Do board.
export async function momentumTask(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const command = z.discriminatedUnion("action", [
      z.object({ action: z.literal("create"), id: z.string().min(1).max(100), content: z.string().trim().min(1).max(3000), date: z.iso.date().nullable().optional() }).strict(),
      z.object({ action: z.literal("complete"), id: z.string().min(1).max(100) }).strict(),
      z.object({ action: z.literal("reschedule"), id: z.string().min(1).max(100), date: z.iso.date() }).strict()
    ]).parse(input);
    const [row] = await db.select().from(kanbanBoard).where(eq(kanbanBoard.userId, owner));
    const before = (row?.data ?? await getToDoList()) as TodoBoard;
    const task = before.flatMap(group => group.items).find(item => item.id === command.id);
    let next: TodoBoard;
    if (command.action === "create") {
      if (task) return { success: true as const, id: command.id };
      next = before.map(group => group.id === "todo" ? { ...group, items: [...group.items, { id: command.id, content: command.content, dueDate: command.date ?? null }] } : group);
    } else {
      if (!task) throw new Error("Source task was removed. Choose another action.");
      if (command.action === "complete" && before.find(group => group.id === "done")?.items.some(item => item.id === command.id)) return { success: true as const, id: command.id };
      next = command.action === "complete" ? moveTodoTask(before, command.id, { groupId: "done", beforeId: null }) : before.map(group => ({ ...group, items: group.items.map(item => item.id === command.id ? { ...item, dueDate: command.date } : item) }));
    }
    const result = await updateToDoList(next, before.length ? before : emptyTodoBoard());
    if (!result.success) return { success: false as const, message: result.message ?? "Newer task changes exist. Reload before retrying." };
    revalidatePath("/account/to-do"); revalidatePath("/account/momentum");
    return { success: true as const, id: command.id };
  } catch (error) { return { success: false as const, message: safeError(error) }; }
}
export async function getMomentumFocus() {
  const owner = await requireUserId();
  const [row] = await db.select({ data: momentumState.data }).from(momentumState).where(eq(momentumState.userId, owner));
  return row?.data.focus.find(item => ["running", "paused", "awaiting"].includes(item.status)) ?? null;
}
export async function getMomentumSummary(input: unknown) {
  const owner = await requireUserId(), { timezone, week } = z.object({ timezone: timezoneSchema, week: z.iso.date() }).parse(input);
  const sources = await readSources(owner), [row] = await db.select().from(momentumState).where(eq(momentumState.userId, owner));
  return summaryWithGoals(sources, sourceActivities(sources, timezone), row?.data ?? emptyMomentum(), week, timezone, new Date().toISOString());
}
export async function getMomentumConflicts(input: unknown) {
  const owner = await requireUserId(), payload = z.object({ source: sourceSchema, date: calendarDay, timing: timingSchema.optional() }).parse(input);
  const sources = await readSources(owner), activities = sourceActivities(sources, "UTC");
  return { ...scheduleConflicts(activities, payload.source, payload.date, payload.timing), input: JSON.stringify(input) };
}
export async function exportMomentum() {
  const owner = await requireUserId(), row = await rowFor(owner);
  return { format: "ud-momentum-v1", exportedAt: new Date().toISOString(), revision: row.revision, data: row.data };
}
