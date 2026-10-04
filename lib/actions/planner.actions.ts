"use server";
import { afterNotificationSourceChange } from "../notifications/store";

import z from "zod";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import db from "../db/drizzle";
import { userEvents } from "../db/schema";
import { requireUserId } from "../session";
import { boardSchema, eventSchema, resetPreset, weekdays, weekDate, weekSchema } from "../events";
import { addCalendarDays } from "../gym/dates";
import { getGymData, scheduleGymWorkout } from "./gym.actions";
import { recordId, timezoneSchema } from "../gym/validation";
import { timingSchema } from "../planner-time";
import type { EventItems } from "@/types/types";
function stableId(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function fail(reason: unknown) {
  return {
    success: false as const,
    message: reason instanceof z.ZodError ? reason.issues[0].message : reason instanceof Error && /^(Membership|Newer|Choose|Preset|Workout)/.test(reason.message) ? reason.message : "Save failed — retry. Check the saved week if the connection was interrupted."
  };
}
async function refresh(owner:string) {
  await afterNotificationSourceChange(owner);
  updateTag("events-data");
  revalidatePath("/account/events");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
async function writeBoard(owner: string, week: string, before: EventItems[], data: EventItems[]) {
  const existing = await db.query.userEvents.findFirst({
    where: and(eq(userEvents.userId, owner), eq(userEvents.week, week))
  });
  if (equal(existing?.data ?? [], data)) return data;
  if (!equal(existing?.data ?? [], before)) throw new Error("Newer event changes exist. Reload this week before trying again.");
  const saved = existing ? (await db.update(userEvents).set({
    data
  }).where(and(eq(userEvents.id, existing.id), eq(userEvents.userId, owner), eq(userEvents.data, existing.data))).returning())[0] : (await db.insert(userEvents).values({
    id: stableId(`${owner}:events:${week}`),
    userId: owner,
    week,
    data
  }).onConflictDoNothing().returning())[0];
  if (!saved) {
    const latest = await db.query.userEvents.findFirst({
      where: and(eq(userEvents.userId, owner), eq(userEvents.week, week))
    });
    if (!equal(latest?.data, data)) throw new Error("Newer event changes exist. Reload this week before trying again.");
  }
  await refresh(owner);
  return data;
}
export async function saveEventBoard(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      week: weekSchema,
      mutationId: recordId,
      before: boardSchema,
      data: boardSchema
    }).parse(input);
    if (payload.data.some(day => day.tasks.some(item => item.kind === "training" || item.workout))) throw new Error("Workout plans must be saved through Gym");
    const old = new Map(payload.before.flatMap(day => day.tasks.map(item => [item.id, item])));
    const data = payload.data.map(day => ({
      ...day,
      tasks: day.tasks.map(item => ({
        ...item,
        // Legacy completed records retain unknown timestamps; reopening never edits their schedule.
        completedAt: item.completed ? old.get(item.id)?.completed ? old.get(item.id)?.completedAt ?? null : item.completedAt || new Date().toISOString() : null
      }))
    }));
    // Retrying a newly completed command reuses its explicit, stable completion timestamp.
    return {
      success: true as const,
      data: await writeBoard(owner, payload.week, payload.before, data as EventItems[])
    };
  } catch (reason) {
    return fail(reason);
  }
}
export async function savePlannerPreset(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      week: weekSchema,
      board: boardSchema,
      includeTraining: z.boolean()
    }).parse(input);
    const data = resetPreset(payload.board as EventItems[], id => id);
    if (payload.includeTraining) {
      const gym = await getGymData(),
        start = weekDate(payload.week);
      for (const plan of gym.plans.filter(plan => plan.date >= start && plan.date <= addCalendarDays(start, 6))) {
        const day = weekdays[Math.round((Date.parse(`${plan.date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000)];
        let target = data.find(row => row.day === day);
        if (!target) {
          target = {
            id: day.toLowerCase(),
            day,
            tasks: []
          };
          data.push(target);
        }
        target.tasks.push({
          id: `preset:${plan.id}`,
          title: plan.data.name,
          completed: false,
          completedAt: null,
          kind: "training",
          icon: "workout",
          tone: "blue",
          timing: plan.data.timing,
          workout: plan.data
        });
      }
    }
    const checked = boardSchema.parse(data),
      existing = await db.query.userEvents.findFirst({
        where: and(eq(userEvents.userId, owner), eq(userEvents.week, "default-WK"))
      });
    if (existing) await db.update(userEvents).set({
      data: checked
    }).where(and(eq(userEvents.id, existing.id), eq(userEvents.userId, owner)));else await db.insert(userEvents).values({
      id: stableId(`${owner}:events:preset`),
      userId: owner,
      week: "default-WK",
      data: checked
    }).onConflictDoUpdate({
      target: userEvents.id,
      set: {
        data: checked
      }
    });
    await refresh(owner);
    return {
      success: true as const
    };
  } catch (reason) {
    return fail(reason);
  }
}
export async function applyPlannerPreset(input: unknown) {
  let manualWritten = false;
  try {
    const owner = await requireUserId(undefined,"write");
    const payload = z.object({
      operationId: recordId,
      week: weekSchema,
      timezone: timezoneSchema,
      before: boardSchema,
      preset: boardSchema
    }).parse(input);
    const start = weekDate(payload.week),
      copy = resetPreset(payload.preset as EventItems[], id => stableId(`${payload.operationId}:${id}`));
    // The sheet may adjust times, but can never submit completed targets or actual results.
    const current = await db.query.userEvents.findFirst({
      where: and(eq(userEvents.userId, owner), eq(userEvents.week, payload.week))
    });
    const manual = copy.map(day => ({
      ...day,
      tasks: day.tasks.filter(item => item.kind !== "training" && !item.workout)
    }));
    const expected = payload.before as EventItems[],
      next = structuredClone(expected);
    for (const day of manual) {
      const target = next.find(row => row.day === day.day);
      if (target) target.tasks.push(...day.tasks);else if (day.tasks.length) next.push(day);
    }
    const alreadyApplied = equal(current?.data ?? [], next);
    if (!alreadyApplied) await writeBoard(owner, payload.week, expected, next);
    manualWritten = true;
    for (const day of copy) for (const item of day.tasks.filter(item => item.kind === "training" && item.workout)) {
      const timing = item.timing ? timingSchema.parse(item.timing) : undefined;
      const result = await scheduleGymWorkout({
        operationId: stableId(`${payload.operationId}:training:${item.id}`),
        data: {
          ...item.workout!,
          timing
        },
        dates: [addCalendarDays(start, weekdays.indexOf(day.day))],
        timezone: payload.timezone
      });
      if (!result.success) throw new Error(result.message);
    }
    await refresh(owner);
    return {
      success: true as const,
      data: next
    };
  } catch (reason) {
    return manualWritten ? {
      success: false as const,
      message: "Preset partially saved. Retry this application to finish without creating duplicates."
    } : fail(reason);
  }
}
export async function getEventPresets() {
  const owner = await requireUserId();
  const row = await db.query.userEvents.findFirst({
    where: and(eq(userEvents.userId, owner), eq(userEvents.week, "event-presets"))
  });
  return (row?.data ?? []) as import("@/types/types").EventItem[];
}
export async function saveEventPreset(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write"),
      payload = z.object({
        event: eventSchema
      }).parse(input);
    const event = {
      ...payload.event,
      id: stableId(`${owner}:event-preset:${payload.event.id}`),
      completed: false,
      completedAt: null
    };
    const row = await db.query.userEvents.findFirst({
      where: and(eq(userEvents.userId, owner), eq(userEvents.week, "event-presets"))
    });
    const before = (row?.data ?? []) as import("@/types/types").EventItem[],
      data = [...before.filter(item => item.id !== event.id), event];
    if (data.length > 100) throw new Error("Preset limit reached. Reuse an existing preset.");
    if (row) {
      const saved = await db.update(userEvents).set({
        data
      }).where(and(eq(userEvents.id, row.id), eq(userEvents.userId, owner), eq(userEvents.data, row.data))).returning();
      if (!saved[0]) throw new Error("Newer presets exist. Reload before saving.");
    } else {
      const inserted = await db.insert(userEvents).values({
        id: stableId(`${owner}:event-presets`),
        userId: owner,
        week: "event-presets",
        data
      }).onConflictDoNothing().returning();
      if (!inserted[0]) {
        const latest = await db.query.userEvents.findFirst({
          where: and(eq(userEvents.userId, owner), eq(userEvents.week, "event-presets"))
        });
        if (!equal(latest?.data, data)) throw new Error("Newer presets exist. Reload before saving.");
      }
    }
    await refresh(owner);
    return {
      success: true as const,
      data
    };
  } catch (reason) {
    return fail(reason);
  }
}

const namedPresetSchema = z.object({ id: recordId, name: z.string().trim().min(1).max(80), board: boardSchema }).strict();
export type NamedWeekPreset = z.infer<typeof namedPresetSchema>;
async function namedPresets(owner: string): Promise<NamedWeekPreset[]> {
  const row = await db.query.userEvents.findFirst({ where: and(eq(userEvents.userId, owner), eq(userEvents.week, "week-presets")) });
  if (row) return z.array(namedPresetSchema).max(3).parse(row.data);
  const legacy = await db.query.userEvents.findFirst({ where: and(eq(userEvents.userId, owner), eq(userEvents.week, "default-WK")) });
  return legacy && (legacy.data as EventItems[]).some(day => day.tasks.length) ? [{ id: stableId(`${owner}:legacy-week-preset`), name: "Saved week", board: boardSchema.parse(legacy.data) }] : [];
}
export async function getNamedWeekPresets() { return namedPresets(await requireUserId()); }
async function writeNamedPresets(owner: string, before: NamedWeekPreset[], data: NamedWeekPreset[]) {
  const row = await db.query.userEvents.findFirst({ where: and(eq(userEvents.userId, owner), eq(userEvents.week, "week-presets")) });
  const current = row ? row.data : await namedPresets(owner);
  if (equal(current, data)) return data;
  if (!equal(current, before)) throw new Error("Newer presets exist. Reload before saving.");
  const saved = row ? await db.update(userEvents).set({ data }).where(and(eq(userEvents.userId, owner), eq(userEvents.id, row.id), eq(userEvents.data, row.data))).returning() : await db.insert(userEvents).values({ id: stableId(`${owner}:week-presets`), userId: owner, week: "week-presets", data }).onConflictDoNothing().returning();
  if (!saved.length && !equal(await namedPresets(owner), data)) throw new Error("Newer presets exist. Reload before saving.");
  await refresh(owner); return data;
}
export async function saveNamedWeekPreset(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write"), value = z.object({ id: recordId, name: z.string().trim().min(1).max(80), week: weekSchema, board: boardSchema, before: z.array(namedPresetSchema).max(3) }).strict().parse(input);
    const data = resetPreset(value.board as EventItems[], id => id), gym = await getGymData(), start = weekDate(value.week);
    for (const plan of gym.plans.filter(plan => plan.date >= start && plan.date <= addCalendarDays(start, 6))) {
      const day = weekdays.find((_, index) => addCalendarDays(start, index) === plan.date)!;
      let target = data.find(row => row.day === day);
      if (!target) { target = { id: day.toLowerCase(), day, tasks: [] }; data.push(target); }
      target.tasks.push({ id: `preset:${plan.id}`, title: plan.data.name, completed: false, completedAt: null, kind: "training", icon: "workout", tone: "blue", timing: plan.data.timing, workout: plan.data });
    }
    const next = [...value.before.filter(item => item.id !== value.id), { id: value.id, name: value.name, board: boardSchema.parse(data) }];
    if (next.length > 3) throw new Error("Choose one of the three saved presets to replace, or remove one first.");
    return { success: true as const, data: await writeNamedPresets(owner, value.before, next) };
  } catch (reason) { return fail(reason); }
}
export async function removeNamedWeekPreset(input: unknown) {
  try { const owner = await requireUserId(undefined,"write"), value = z.object({ id: recordId, before: z.array(namedPresetSchema).max(3) }).strict().parse(input); return { success: true as const, data: await writeNamedPresets(owner, value.before, value.before.filter(item => item.id !== value.id)) }; } catch (reason) { return fail(reason); }
}
export async function removeEventPreset(input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write"), { id } = z.object({ id: z.string().min(1).max(150) }).strict().parse(input);
    const row = await db.query.userEvents.findFirst({ where: and(eq(userEvents.userId, owner), eq(userEvents.week, "event-presets")) });
    const before = (row?.data ?? []) as import("@/types/types").EventItem[], data = before.filter(item => item.id !== id);
    if (row && data.length !== before.length) { const saved = await db.update(userEvents).set({ data }).where(and(eq(userEvents.id, row.id), eq(userEvents.userId, owner), eq(userEvents.data, row.data))).returning(); if (!saved.length) throw new Error("Newer presets exist. Reload before removing."); }
    await refresh(owner); return { success: true as const, data };
  } catch (reason) { return fail(reason); }
}
