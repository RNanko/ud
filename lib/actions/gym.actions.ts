"use server";
import { afterNotificationSourceChange } from "../notifications/store";

import z from "zod";
import { createHash } from "crypto";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "../db/drizzle";
import { gymEntities, gymPlans, gymRestDays, gymSessions } from "../db/schema";
import { requireUserId } from "../session";
import { blueprintSchema, calendarDay, definitionSchema, recordId, sessionSchema, timezoneSchema } from "../gym/validation";
import { newSession } from "../gym/logic";
import { prepareSessionSave } from '../gym/session-write';
import { accountSettings } from "../account/store";
import { addCalendarDays, weekStart } from "../gym/dates";
import type { Blueprint, ExerciseDefinition, GymData, PlanRecord, SessionRecord, TemplateRecord } from "../gym/types";
import { timingSchema } from "../planner-time";
const revisionSchema = z.number().int().nonnegative().nullable();
const editable = z.object({
  id: recordId,
  revision: revisionSchema,
  mutationId: recordId
});
const templateRecord = (row: typeof gymEntities.$inferSelect): TemplateRecord => ({
  id: row.id,
  data: row.data as Blueprint,
  revision: row.revision
});
const definitionRecord = (row: typeof gymEntities.$inferSelect) => ({
  id: row.id,
  data: row.data as ExerciseDefinition,
  revision: row.revision
});
const planRecord = (row: typeof gymPlans.$inferSelect): PlanRecord => ({
  id: row.id,
  data: row.data,
  date: row.date,
  timezone: row.timezone,
  revision: row.revision
});
const sessionRecord = (row: typeof gymSessions.$inferSelect): SessionRecord => ({
  id: row.id,
  data: row.data,
  planId: row.planId,
  revision: row.revision
});
const failure = (reason: unknown) => ({
  success: false as const,
  message: reason instanceof z.ZodError ? reason.issues[0].message : reason instanceof Error && ["Choose", "Workout", "Session", "Newer", "Completed", "Previous", "Sign"].some(start => reason.message.startsWith(start)) ? reason.message : "Save failed — retry. Your entered details are still here."
});
async function refresh(owner:string) {
  await afterNotificationSourceChange(owner);
  revalidatePath("/account/gym");
  revalidatePath("/account/events");
}
function stableId(operation: string, key: string) {
  const hash = createHash("sha256").update(`${operation}:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export async function getGymData(): Promise<GymData> {
  const owner = await requireUserId();
  const [entities, plans, sessions, rest] = await Promise.all([db.select().from(gymEntities).where(and(eq(gymEntities.userId, owner), eq(gymEntities.archived, false))), db.select().from(gymPlans).where(and(eq(gymPlans.userId, owner), eq(gymPlans.archived, false))), db.select().from(gymSessions).where(and(eq(gymSessions.userId, owner), eq(gymSessions.archived, false))), db.select().from(gymRestDays).where(and(eq(gymRestDays.userId, owner), eq(gymRestDays.rest, true)))]);
  return {
    templates: entities.filter(row => row.kind === "template").map(templateRecord),
    customExercises: entities.filter(row => row.kind === "exercise").map(definitionRecord),
    plans: plans.map(planRecord),
    sessions: sessions.map(sessionRecord),
    restDays: rest.map(row => row.date)
  };
}
export async function saveGymEntity(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = editable.extend({
      kind: z.enum(["template", "exercise"]),
      data: z.unknown()
    }).parse(input);
    const data = payload.kind === "template" ? blueprintSchema.parse(payload.data) : definitionSchema.parse(payload.data);
    if (payload.kind === "exercise" && (data as ExerciseDefinition).id !== payload.id) throw new Error("Choose a valid custom exercise ID");
    const rows = payload.revision === null ? await db.insert(gymEntities).values({
      id: payload.id,
      userId: owner,
      kind: payload.kind,
      data,
      lastMutation: payload.mutationId
    }).onConflictDoNothing().returning() : await db.update(gymEntities).set({
      data,
      lastMutation: payload.mutationId,
      revision: sql`${gymEntities.revision} + 1`
    }).where(and(eq(gymEntities.id, payload.id), eq(gymEntities.userId, owner), eq(gymEntities.kind, payload.kind), eq(gymEntities.archived, false), eq(gymEntities.revision, payload.revision))).returning();
    const saved = rows[0] || (await db.select().from(gymEntities).where(and(eq(gymEntities.id, payload.id), eq(gymEntities.userId, owner), eq(gymEntities.kind, payload.kind), eq(gymEntities.archived, false))))[0];
    if (!saved || saved.lastMutation !== payload.mutationId) throw new Error("Newer changes exist. Reopen this workout before editing.");
    await refresh(owner);
    return {
      success: true as const,
      kind: payload.kind,
      record: payload.kind === "template" ? templateRecord(saved) : definitionRecord(saved)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function scheduleGymWorkout(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      operationId: recordId,
      dates: z.array(calendarDay).min(1).max(31),
      timezone: timezoneSchema,
      data: blueprintSchema
    }).parse(input);
    const dates = [...new Set(payload.dates)];
    const values = dates.map(date => ({
      id: stableId(payload.operationId, date),
      userId: owner,
      date,
      timezone: payload.timezone,
      data: payload.data,
      lastMutation: payload.operationId
    }));
    await db.insert(gymPlans).values(values).onConflictDoNothing();
    // A retry uses the same operation ID, so it cannot schedule a second copy.
    const records = await db.select().from(gymPlans).where(and(eq(gymPlans.userId, owner), eq(gymPlans.lastMutation, payload.operationId), eq(gymPlans.archived, false)));
    await refresh(owner);
    return {
      success: true as const,
      plans: records.map(planRecord)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function editGymPlan(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = editable.extend({
      date: calendarDay,
      timezone: timezoneSchema,
      data: blueprintSchema
    }).parse(input);
    const linked = await db.select({
      id: gymSessions.id
    }).from(gymSessions).where(and(eq(gymSessions.planId, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false)));
    if (linked.length) throw new Error("Workout already has a log. Its original planned targets are preserved in that log.");
    const rows = await db.update(gymPlans).set({
      data: payload.data,
      date: payload.date,
      timezone: payload.timezone,
      lastMutation: payload.mutationId,
      revision: sql`${gymPlans.revision} + 1`
    }).where(and(eq(gymPlans.id, payload.id), eq(gymPlans.userId, owner), eq(gymPlans.archived, false), eq(gymPlans.revision, payload.revision ?? -1))).returning();
    const saved = rows[0] || (await db.select().from(gymPlans).where(and(eq(gymPlans.id, payload.id), eq(gymPlans.userId, owner), eq(gymPlans.archived, false))))[0];
    if (!saved || saved.lastMutation !== payload.mutationId) throw new Error("Newer changes exist. Reopen this plan before editing.");
    await refresh(owner);
    return {
      success: true as const,
      plan: planRecord(saved)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function editGymPlanSchedule(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write"), payload = editable.extend({ date: calendarDay, timezone: timezoneSchema, timing: timingSchema }).parse(input);
    const existing = (await db.select().from(gymPlans).where(and(eq(gymPlans.id, payload.id), eq(gymPlans.userId, owner), eq(gymPlans.archived, false))))[0];
    if (!existing) throw new Error("Workout plan not found");
    if (existing.lastMutation === payload.mutationId) return { success: true as const, plan: planRecord(existing) };
    const data = { ...existing.data, timing: payload.timing };
    const saved = (await db.update(gymPlans).set({ data, date: payload.date, timezone: payload.timezone, lastMutation: payload.mutationId, revision: sql`${gymPlans.revision} + 1` }).where(and(eq(gymPlans.id, payload.id), eq(gymPlans.userId, owner), eq(gymPlans.archived, false), eq(gymPlans.revision, payload.revision ?? -1))).returning())[0];
    const acknowledged = saved || (await db.select().from(gymPlans).where(and(eq(gymPlans.id, payload.id), eq(gymPlans.userId, owner), eq(gymPlans.archived, false))))[0];
    if (!acknowledged || acknowledged.lastMutation !== payload.mutationId) throw new Error("Newer changes exist. Reload this schedule before saving.");
    await refresh(owner); return { success: true as const, plan: planRecord(acknowledged) };
  } catch (reason) { return failure(reason); }
}
export async function copyGymWeek(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      operationId: recordId,
      from: calendarDay,
      to: calendarDay,
      timezone: timezoneSchema
    }).parse(input);
    const startsOn=(await accountSettings(owner)).preferences.weekStart;
    const from = weekStart(payload.from,startsOn),
      to = weekStart(payload.to,startsOn);
    if (from === to) throw new Error("Choose a different destination week");
    const source = await db.select().from(gymPlans).where(and(eq(gymPlans.userId, owner), eq(gymPlans.archived, false), gte(gymPlans.date, from), lte(gymPlans.date, addCalendarDays(from, 6))));
    const values = source.map(plan => ({
      id: stableId(payload.operationId, plan.id),
      userId: owner,
      date: addCalendarDays(to, Math.round((Date.parse(`${plan.date}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)),
      timezone: payload.timezone,
      data: plan.data,
      lastMutation: payload.operationId
    }));
    if (values.length) await db.insert(gymPlans).values(values).onConflictDoNothing();
    const records = await db.select().from(gymPlans).where(and(eq(gymPlans.userId, owner), eq(gymPlans.lastMutation, payload.operationId), eq(gymPlans.archived, false)));
    await refresh(owner);
    return {
      success: true as const,
      plans: records.map(planRecord)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function startGymSession(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      id: recordId,
      planId: recordId.nullable(),
      data: blueprintSchema.nullable(),
      date: calendarDay,
      timezone: timezoneSchema,
      logged: z.boolean()
    }).parse(input);
    let blueprint = payload.data;
    if (payload.planId) {
      const plans = await db.select().from(gymPlans).where(and(eq(gymPlans.id, payload.planId), eq(gymPlans.userId, owner), eq(gymPlans.archived, false)));
      if (!plans[0]) throw new Error("Workout plan not found");
      blueprint = plans[0].data;
    }
    if (!blueprint) throw new Error("Choose exercises before starting");
    const data = sessionSchema.parse(newSession(blueprint, payload.date, payload.timezone, payload.logged, !!payload.planId || !payload.logged));
    const rows = await db.insert(gymSessions).values({
      id: payload.id,
      userId: owner,
      planId: payload.planId,
      data,
      lastMutation: payload.id
    }).onConflictDoNothing().returning();
    const saved = rows[0] || (await db.select().from(gymSessions).where(and(eq(gymSessions.userId, owner), payload.planId ? eq(gymSessions.planId, payload.planId) : eq(gymSessions.id, payload.id))))[0];
    if (!saved) throw new Error("Session not found");
    if (saved.archived) throw new Error("Previous log was removed. Duplicate this plan to start a new workout.");
    await refresh(owner);
    return {
      success: true as const,
      session: sessionRecord(saved)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function saveGymSession(input: unknown) {
  try {
    const owner = await requireUserId();
    const payload = editable.extend({
      data: z.unknown()
    }).parse(input);
    const existing = (await db.select().from(gymSessions).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false))))[0];
    if (!existing) throw new Error("Session not found");
    if (existing.lastMutation === payload.mutationId) return {
      success: true as const,
      session: sessionRecord(existing)
    };
    await requireUserId(owner,"write",{kind:"workout",id:payload.id});
    const data = prepareSessionSave(existing.data,payload.data);
    const saved = (await db.update(gymSessions).set({
      data,
      lastMutation: payload.mutationId,
      revision: sql`${gymSessions.revision} + 1`
    }).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false), eq(gymSessions.revision, payload.revision ?? -1))).returning())[0];
    const acknowledged = saved || (await db.select().from(gymSessions).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false))))[0];
    if (!acknowledged || acknowledged.lastMutation !== payload.mutationId) throw new Error("Newer changes exist in another window. Reload this session before saving.");
    await refresh(owner);
    return {
      success: true as const,
      session: sessionRecord(acknowledged)
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function completeGymWorkout(input: unknown) {
  try {
    const owner = await requireUserId();
    const payload = z.object({ id: recordId, sessionId: recordId.nullable(), planId: recordId.nullable(), mutationId: recordId, revision: revisionSchema, date: calendarDay, timezone: timezoneSchema, notes: z.string().max(3000) }).parse(input);
    let record: SessionRecord;
    if (payload.sessionId) {
      const existing = (await db.select().from(gymSessions).where(and(eq(gymSessions.id, payload.sessionId), eq(gymSessions.userId, owner), eq(gymSessions.archived, false))))[0];
      if (!existing) throw new Error("Session not found");
      record = sessionRecord(existing);
    } else {
      if (!payload.planId) throw new Error("Choose a workout plan");
      const result = await startGymSession({ id: payload.id, planId: payload.planId, data: null, date: payload.date, timezone: payload.timezone, logged: true });
      if (!result.success) return result;
      record = result.session;
    }
    if (record.data.status === "completed") return { success: true as const, session: record };
    const hasDetails = record.data.exercises.some(item => item.cardio?.completed || item.sets.some(set => set.completed));
    return await saveGymSession({ id: record.id, mutationId: payload.mutationId, revision: payload.sessionId ? payload.revision : record.revision, data: {
      ...record.data, status: "completed", completionMode: hasDetails ? "detailed" : "confirmation", date: payload.date, timezone: payload.timezone,
      notes: payload.notes, finishedAt: new Date().toISOString(), restUntil: null,
    } });
  } catch (reason) { return failure(reason); }
}
export async function reopenGymWorkout(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write"), payload = editable.parse(input);
    const existing = (await db.select().from(gymSessions).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false))))[0];
    if (!existing) throw new Error("Session not found");
    if (existing.lastMutation === payload.mutationId) return { success: true as const, session: sessionRecord(existing) };
    if (existing.data.status !== "completed") throw new Error("Workout is already active. Reload the saved version.");
    const data = sessionSchema.parse({ ...existing.data, status: "active", completionMode: "detailed", finishedAt: null, restUntil: null });
    const saved = (await db.update(gymSessions).set({ data, lastMutation: payload.mutationId, revision: sql`${gymSessions.revision} + 1` }).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false), eq(gymSessions.revision, payload.revision ?? -1))).returning())[0];
    const acknowledged = saved || (await db.select().from(gymSessions).where(and(eq(gymSessions.id, payload.id), eq(gymSessions.userId, owner), eq(gymSessions.archived, false))))[0];
    if (!acknowledged || acknowledged.lastMutation !== payload.mutationId) throw new Error("Newer changes exist. Reload the workout before reopening.");
    await refresh(owner); return { success: true as const, session: sessionRecord(acknowledged) };
  } catch (reason) { return failure(reason); }
}
export async function setGymRestDay(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      date: calendarDay,
      timezone: timezoneSchema,
      rest: z.boolean()
    }).parse(input);
    await db.insert(gymRestDays).values({
      id: `${owner}:${payload.date}`,
      userId: owner,
      ...payload
    }).onConflictDoUpdate({
      target: [gymRestDays.userId, gymRestDays.date],
      set: {
        rest: payload.rest,
        timezone: payload.timezone
      }
    });
    await refresh(owner);
    return {
      success: true as const
    };
  } catch (reason) {
    return failure(reason);
  }
}
export async function archiveGymRecord(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      id: recordId,
      kind: z.enum(["plan", "session", "entity"]),
      archived: z.boolean()
    }).parse(input);
    // Removing a plan changes only the plan; linked actual results remain intact.
    const table = payload.kind === "plan" ? gymPlans : payload.kind === "session" ? gymSessions : gymEntities;
    const saved = await db.update(table).set({
      archived: payload.archived
    }).where(and(eq(table.id, payload.id), eq(table.userId, owner))).returning({
      id: table.id
    });
    if (!saved[0]) throw new Error("Workout not found");
    await refresh(owner);
    return {
      success: true as const
    };
  } catch (reason) {
    return failure(reason);
  }
}
