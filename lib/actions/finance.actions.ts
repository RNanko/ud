"use server";

import { headers } from "next/headers";
import { auth } from "../auth";
import db from "../db/drizzle";
import { financeTable, financeCategories } from "../db/schema";
import { financeEntrySchema, financeTableSchema } from "@/types/validators";
import { serializeFinanceEntry } from "../finance";
import { formatError } from "../utils";
import { eq, desc, and, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { requireUserId } from "../session";
import z from "zod";
import { accountSettings } from "../account/store";
import { cashMinor, cashString } from "../account/decimal";

export async function getFinanceCategories(userId?: string) {
  const owner = await requireUserId(userId);
  const rows = await db.select({ name: financeCategories.name, type: financeCategories.type, hidden: financeCategories.hidden }).from(financeCategories).where(eq(financeCategories.userId, owner));
  return rows.map((row) => ({ name: row.name, type: row.type === "+" ? "+" as const : "-" as const, hidden: row.hidden }));
}

export async function createFinanceCategory(input: unknown) {
  try {
    const userId = await requireUserId(undefined,"write");
    const parsed = z.object({ name: z.string().trim().min(1, "Name your category").max(60, "Use 60 characters or fewer"), type: z.enum(["+", "-"]) }).safeParse(input);
    if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
    const { name, type } = parsed.data;
    // Concurrent submissions and case variations resolve to one category per owner and type.
    const rows = await db.insert(financeCategories).values({ id: crypto.randomUUID(), userId, name, type, hidden: false, normalizedName: name.toLocaleLowerCase("en") })
      .onConflictDoUpdate({ target: [financeCategories.userId, financeCategories.type, financeCategories.normalizedName], set: { hidden: false } })
      .returning({ name: financeCategories.name, type: financeCategories.type });
    return { success: true as const, category: { name: rows[0].name, type }, message: "Category ready" };
  } catch { return { success: false as const, message: "Could not save your category. Please try again." }; }
}

async function setCategoryHidden(input: unknown, hidden: boolean) {
  try {
    const userId = await requireUserId(undefined,"write");
    const parsed = z.object({ name: z.string().trim().min(1).max(200), type: z.enum(["+", "-"]) }).safeParse(input);
    if (!parsed.success) return { success: false as const, message: "Select a valid category" };
    const { name, type } = parsed.data;
    // Tombstones also cover starter categories and categories inferred from history.
    // The transaction table is never changed by a category removal.
    await db.insert(financeCategories).values({ id: crypto.randomUUID(), userId, name, type, hidden, normalizedName: name.toLocaleLowerCase("en") })
      .onConflictDoUpdate({ target: [financeCategories.userId, financeCategories.type, financeCategories.normalizedName], set: { hidden } });
    return { success: true as const, category: { name, type, hidden }, message: hidden ? "Category removed" : "Category restored" };
  } catch { return { success: false as const, message: "Could not change this category. Please try again." }; }
}

export async function removeFinanceCategory(input: unknown) { return setCategoryHidden(input, true); }
export async function restoreFinanceCategory(input: unknown) { return setCategoryHidden(input, false); }

export async function saveFinanceEntry(id: string | null, input: unknown) {
  try {
    const userId = await requireUserId(undefined,"write");
    const parsed = financeEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
    if (id !== null && (typeof id !== "string" || !id.trim())) {
      return { success: false as const, message: "Record not found" };
    }
    const data = parsed.data;
    const values = {
      type: data.type, date: new Date(data.date), amount: cashString(cashMinor((input as {amount:string}).amount)),
      category: data.category, subcategory: data.subcategory || null, comment: data.comment || null,
    };
    const rows = id === null
      ? await db.insert(financeTable).values({ ...values,currency:data.currency??(await accountSettings(userId)).preferences.financeDefaultCurrency, id: crypto.randomUUID(), userId }).returning()
      : await db.update(financeTable).set(values)
        .where(and(eq(financeTable.id, id), eq(financeTable.userId, userId))).returning();
    if (!rows[0]) return { success: false as const, message: "Record not found" };
    updateTag("finance-data");
    return { success: true as const, message: id ? "Transaction updated" : "Transaction added", entry: serializeFinanceEntry(rows[0]) };
  } catch {
    return { success: false as const, message: "Could not save. Check your connection and try again." };
  }
}

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
    await requireUserId(userId,"write");
    const currency=(await accountSettings(userId)).preferences.financeDefaultCurrency;
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
        id: crypto.randomUUID(),
        userId,
        date: new Date(data.date),
        category: data.category,
        subcategory: data.subcategory ?? null,
        amount: cashString(cashMinor(String(formData.get("amount")))),currency,
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
      message: await formatError(error),
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
    await requireUserId(userId,"write");
    const currency=(await accountSettings(userId)).preferences.financeDefaultCurrency;
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
        id: crypto.randomUUID(),
        userId,
        date: new Date(data.date),
        category: data.category,
        subcategory: data.subcategory ?? null,
        amount: cashString(cashMinor(String(formData.get("amount")))),currency,
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
      message: await formatError(error),
    };
  }
}

export async function getFinanceData(userId?: string) {
  return getCachedFinanceData(await requireUserId(userId));
}

async function getCachedFinanceData(userId: string) {
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
  try {
    const userId = await requireUserId(undefined,"write");
    const removed = await db.delete(financeTable)
      .where(and(eq(financeTable.id, id), eq(financeTable.userId, userId)))
      .returning({ id: financeTable.id });
    if (!removed.length) return { message: "Record not found", success: false };
    updateTag("finance-data");
    return { message: "Deleted", success: true };
  } catch {
    return { message: "Unable to delete this record", success: false };
  }
}

export async function updateListItem(
  id: string,
  category: string,
  value: string,
) {
  try {
    const userId = await requireUserId(undefined,"write");
    const fields = {
      type: z.enum(["+", "-"]),
      date: z.iso.date().transform((date) => new Date(date)),
      category: z.string().trim().min(1).max(200),
      subcategory: z.string().trim().min(1).max(200),
      amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).transform(value=>cashString(cashMinor(value))),
      comment: z.string().max(5000),
    };
    if (!Object.hasOwn(fields, category)) {
      return { message: "Select a valid field", success: false };
    }
    const parsed = fields[category as keyof typeof fields].safeParse(value);
    if (!parsed.success) return { message: "Enter a valid value for this field", success: false };
    const updated = await db.update(financeTable)
      .set({ [category]: parsed.data })
      .where(and(eq(financeTable.id, id), eq(financeTable.userId, userId)))
      .returning({ id: financeTable.id });
    if (!updated.length) return { message: "Record not found", success: false };
    updateTag("finance-data");
    return { message: "Updated", success: true };
  } catch {
    return { message: "Unable to update this record", success: false };
  }
}

export async function getChartIncomeOutcomeData(
  userId: string,
  onlyCurrentMonth?: boolean
) {
  userId = await requireUserId(userId);

  const currency=(await accountSettings(userId)).preferences.financeDefaultCurrency;
  const conditions = [
    eq(financeTable.userId, userId),eq(financeTable.currency,currency),
  ];

  if (onlyCurrentMonth) {
    conditions.push(sql`
      date_trunc('month', ${financeTable.date})
      = date_trunc('month', CURRENT_DATE)
    `);
  }

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
    .where(and(...conditions))
    .groupBy(sql`to_char(${financeTable.date}, 'Month')`)
    .orderBy(sql`MIN(${financeTable.date})`);

  return data.map((row) => ({
    month: row.month.trim(),
    income: Number(row.income ?? 0),
    outcome: -Math.abs(Number(row.outcome ?? 0)),
  }));
}


