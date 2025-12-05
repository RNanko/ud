"use server";

import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { financeTable } from "../db/schema";
import { financeTableSchema } from "@/types/validators";
import { formatError } from "../utils";
import { eq, desc  } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";

export async function addExpens(prevState: unknown, formData: FormData) {
  try {
    // SERVER-SIDE session
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userId = session?.session?.userId;

    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }
    const data = financeTableSchema.parse({
      date: formData.get("date") as string,
      category: formData.get("category") as string,
      subcategory: formData.get("subcategory") as string,
      amount: formData.get("amount") as string,
      comment: (formData.get("comment") as string) || null,
    });

    const result = await db
      .insert(financeTable)
      .values({
        id: Date.now().toString(),
        userId,
        date: new Date(data.date),
        category: data.category,
        subcategory: data.subcategory ?? null,
        amount: data.amount.toString(),
        comment: data.comment ?? null,
        type: "-",
      })
      .returning();

    updateTag("finance-data");

    return {
      success: true,
      message: "Expense added to DB",
      data: result[0],
    };
  } catch (error) {
    console.error("ADD EXPENSE ERROR:");

    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function addIncome(prevState: unknown, formData: FormData) {
  try {
    // SERVER-SIDE session
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userId = session?.session?.userId;

    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }
    const data = financeTableSchema.parse({
      date: formData.get("date") as string,
      category: formData.get("category") as string,
      subcategory: formData.get("subcategory") as string,
      amount: formData.get("amount") as string,
      comment: (formData.get("comment") as string) || null,
    });

    const result = await db
      .insert(financeTable)
      .values({
        id: Date.now().toString(),
        userId,
        date: new Date(data.date),
        category: data.category,
        subcategory: data.subcategory ?? null,
        amount: data.amount.toString(),
        comment: data.comment ?? null,
        type: "+",
      })
      .returning();

    updateTag("finance-data");

    return {
      success: true,
      message: "Income added to DB",
      data: result[0],
    };
  } catch (error) {
    console.error("ADD INCOME ERROR:");

    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function getFinanceData(userId?: string) {
  "use cache";
  cacheTag("finance-data");
  // stale: How long the client can use cached data without checking the server
  cacheLife({ expire: 3600, revalidate: 900, stale: 300 });
  if (!userId) return [];
  // if (!userId) throw Error('Test');

  const data = await db
    .select()
    .from(financeTable)
    .where(eq(financeTable.userId, userId))
    .orderBy(desc(financeTable.createdAt));

  return data;
}
