import "server-only";
import { neon } from "@neondatabase/serverless";
import { PERSONAL_PRODUCT } from "./config";
import { defaultPreferences, defaultNotifications, preferenceSchema, notificationSchema } from "./preferences";
export const accountSql = neon(process.env.DATABASE_URL!);
export async function accountSettings(owner: string) {
  const rows = await accountSql`SELECT preferences, notifications, revision FROM b1_account_settings WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  return { preferences: preferenceSchema.parse(rows[0]?.preferences ?? defaultPreferences), notifications: notificationSchema.parse(rows[0]?.notifications ?? defaultNotifications), revision: Number(rows[0]?.revision ?? 0) };
}
export async function membershipFor(owner: string) {
  const rows = await accountSql`SELECT * FROM b1_memberships WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  return rows[0] ?? null;
}
