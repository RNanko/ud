"use server";

import db from "../db/drizzle";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";

export default async function GetAccountData(userId: string) {
  if (!userId) return null;

  // await new Promise((res) => setTimeout(res, 100000));

  const result = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result[0] ?? null;
}
