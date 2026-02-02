"use server";

import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { financeTable } from "../db/schema";
import { financeTableSchema } from "@/types/validators";
import { formatError } from "../utils";
import { eq, desc, and, sql } from "drizzle-orm";
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

  const data = await db
    .select()
    .from(financeTable)
    .where(eq(financeTable.userId, userId))
    .orderBy(desc(financeTable.createdAt));

  return data;
}

export async function removeListItem(id: string) {
  await db.delete(financeTable).where(and(eq(financeTable.id, id)));
  updateTag("finance-data");
  return { message: "Deleted", success: true };
}

export async function updateListItem(
  id: string,
  category: string,
  value: string,
) {
  let parsedValue;

  // Number fields
  if (category === "amount") {
    parsedValue = Number(value);
  }

  // Date/Timestamp fields

  if (category === "date") {
    parsedValue = new Date(value); // Drizzle accepts Date object
  } else {
    parsedValue = String(value);
  }

  await db
    .update(financeTable)
    .set({ [category]: parsedValue })
    .where(eq(financeTable.id, id)); // ← REQUIRED

  updateTag("finance-data");

  return { message: "Updated", success: true };
}

export async function getChartIncomeOutcomeData(userId: string) {
  if (!userId) return [];

  const data = await db
    .select({
      month: sql<string>`to_char(${financeTable.date}, 'Month')`,
      income: sql<number>`
        COALESCE(
          SUM(CASE WHEN ${financeTable.type} = '+'
          THEN ${financeTable.amount} ELSE 0 END),
        0)
      `,
      outcome: sql<number>`
        COALESCE(
          SUM(CASE WHEN ${financeTable.type} = '-'
          THEN -${financeTable.amount} ELSE 0 END),
        0)
      `,
    })
    .from(financeTable)
    .where(eq(financeTable.userId, userId))
    .groupBy(sql`to_char(${financeTable.date}, 'Month')`)
    .orderBy(sql`MIN(${financeTable.date})`);

  return data.map((row) => ({
    month: row.month.trim(), 
    income: Number(row.income ?? 0),
    outcome: -Math.abs(Number(row.outcome ?? 0)),
  }));
}
