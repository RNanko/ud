"use server";
import db from "../db/drizzle";
import { eq } from "drizzle-orm";
import { user } from "../db/schema";
import { revalidatePath } from "next/cache";
import { requireUserId } from "../session";
import { accountSettings, accountSql } from "../account/store";
import { PERSONAL_PRODUCT } from "../account/config";
import { notificationSchema, preferenceSchema } from "../account/preferences";
import z from "zod";
export default async function GetAccountData(requested: string) {
 const owner=await requireUserId(requested);
 const rows=await db.select({id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified,createdAt:user.createdAt}).from(user).where(eq(user.id,owner)).limit(1);
 return rows[0];
}
export async function saveAccountName(input: unknown) {
 const owner=await requireUserId();
 const {name}=z.object({name:z.string().trim().min(1).max(80)}).strict().parse(input);
 await db.update(user).set({name,updatedAt:new Date()}).where(eq(user.id,owner));
 revalidatePath("/account","layout"); return {name};
}
export async function saveAccountSettings(input: unknown) {
 const owner=await requireUserId();
 const data=z.object({section:z.enum(["preferences","notifications"]),revision:z.number().int().nonnegative(),value:z.unknown()}).strict().parse(input);
 const current=await accountSettings(owner);
 const preferences=data.section==="preferences"?preferenceSchema.parse(data.value):current.preferences;
 const notifications=data.section==="notifications"?notificationSchema.parse(data.value):current.notifications;
 const rows=data.revision===0?await accountSql`INSERT INTO b1_account_settings(user_id,product,preferences,notifications,revision)
  VALUES (${owner},${PERSONAL_PRODUCT},${JSON.stringify(preferences)}::jsonb,${JSON.stringify(notifications)}::jsonb,1)
  ON CONFLICT(user_id,product) DO NOTHING RETURNING revision`:await accountSql`UPDATE b1_account_settings SET preferences=${JSON.stringify(preferences)}::jsonb,notifications=${JSON.stringify(notifications)}::jsonb,revision=revision+1,updated_at=now()
  WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND revision=${data.revision} RETURNING revision`;
 if(!rows[0]) throw new Error("Settings changed on another device. Reload before saving.");
 revalidatePath("/account","layout"); return {preferences,notifications,revision:Number(rows[0].revision)};
}
// Reject compatibility calls from older open tabs.
export async function updateAvatar(_file: File): Promise<string> { void _file; await requireUserId(); throw new Error("Account image uploads are no longer supported"); }
