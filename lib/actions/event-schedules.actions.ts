"use server";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { requireUserId } from "../session";
import { accountSettings } from "../account/store";
import { dateInZone } from "../gym/dates";
import { addCalendarDays } from "../calendar";
import { createEventSchedule, stopEventSchedule, writeScheduledOccurrence, readEventSchedules } from "../events/schedule-store";
import { afterNotificationSourceChange } from "../notifications/store";
import { z } from "zod";
import { eventSchema } from "../events";
import { calendarDay } from "../gym/validation";
function changed(owner: string) {
  revalidateTag("events-data", { expire: 0 });
  after(() => afterNotificationSourceChange(owner));
}
function message(error: unknown) {
  return error instanceof Error && /^(Choose|Newer|This|Scheduled|Too many)/.test(error.message) ? error.message : "Schedule save failed. Your changes are retained; retry.";
}
export async function getEventSchedules() { return readEventSchedules(await requireUserId()); }
export async function saveNewEventSchedule(input: unknown) {
  try { const owner = await requireUserId(undefined, "write"), data = await createEventSchedule(owner, input); changed(owner); return { success: true as const, data }; }
  catch (error) { return { success: false as const, message: message(error) }; }
}
export async function stopScheduledEvents(input: { operationId: string; id: string; revision: number }) {
  try {
    const owner = await requireUserId(), settings = await accountSettings(owner);
    const from = addCalendarDays(dateInZone(new Date(), settings.preferences.timezone), 1);
    const data = await stopEventSchedule(owner, { ...input, from }); changed(owner); return { success: true as const, data };
  } catch (error) { return { success: false as const, message: message(error) }; }
}
export async function saveScheduledEvent(input: unknown, expectedOwner?: string) {
  try { const command = z.object({ operationId: z.uuid(), before: eventSchema, event: eventSchema.nullable(), date: calendarDay }).strict().parse(input); const owner = await requireUserId(expectedOwner, command.event === null ? "read" : "write"), data = await writeScheduledOccurrence(owner, command); changed(owner); return { success: true as const, data }; }
  catch (error) { return { success: false as const, message: message(error) }; }
}
