import z from "zod";
import { financeCurrencies } from "./config";
const zone = z.string().min(1).max(100).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose an IANA timezone");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const preferenceSchema = z.object({
  financeDefaultCurrency: z.enum(financeCurrencies), exerciseLoad: z.enum(["kg", "lb"]), bodyWeight: z.enum(["kg", "lb"]),
  distance: z.enum(["km", "mi"]), measurements: z.enum(["cm", "ft-in"]), language: z.literal("en"),
  timezone: zone, weekStart: z.enum(["monday", "sunday"]), timeFormat: z.enum(["12", "24"]),
  dateFormat: z.enum(["iso", "day-first", "month-first"]), numberLocale: z.enum(["en-US", "en-GB", "pl-PL"]),
  theme: z.literal("blue-orange"), reducedMotion: z.enum(["system", "reduce"]),
}).strict();
export const notificationSchema = z.object({
  eventReminders: z.boolean(), goalReminders: z.boolean(), weeklyReview: z.boolean(), trialReminder: z.boolean(),
  email: z.boolean(), marketing: z.boolean(), quietHours: z.boolean(), quietFrom: clock, quietTo: clock,
  workoutCompletion: z.boolean().default(true), productUpdates: z.boolean().default(true),
}).strict();
export type AccountPreferences = z.infer<typeof preferenceSchema>;
export type NotificationPreferences = z.infer<typeof notificationSchema>;
export const defaultPreferences: AccountPreferences = {
  financeDefaultCurrency: "USD", exerciseLoad: "kg", bodyWeight: "kg", distance: "km", measurements: "cm", language: "en",
  timezone: "Europe/Warsaw", weekStart: "monday", timeFormat: "24", dateFormat: "day-first", numberLocale: "en-GB",
  theme: "blue-orange", reducedMotion: "system",
};
export const defaultNotifications: NotificationPreferences = { eventReminders: true, goalReminders: true, weeklyReview: true, trialReminder: true, email: false, marketing: false, quietHours: true, quietFrom: "22:00", quietTo: "08:00", workoutCompletion:true, productUpdates:true };
export function quietNow(preferences: NotificationPreferences, now: Date, timezone: string) {
  if (!preferences.quietHours) return false;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return preferences.quietFrom <= preferences.quietTo ? time >= preferences.quietFrom && time < preferences.quietTo : time >= preferences.quietFrom || time < preferences.quietTo;
}
