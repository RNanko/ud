"use server";

import db from "../db/drizzle";
import { financeTable, financeCategories } from "../db/schema";

import { eq, desc, and, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { requireUserId } from "../session";

import { accountSettings } from "../account/store";

import { writeMobileFinance } from "../mobile/finance";
import { readFinanceSnapshot } from "../money/snapshots";
import { moneyAction } from "../money/action-result";
import { dateInZone } from "../gym/dates";

export async function getFinanceCategories(userId?: string) {
  const owner = await requireUserId(userId);
  const rows = await db.select({ name: financeCategories.name, type: financeCategories.type, hidden: financeCategories.hidden }).from(financeCategories).where(eq(financeCategories.userId, owner));
  return rows.map((row) => ({ name: row.name, type: row.type === "+" ? "+" as const : "-" as const, hidden: row.hidden }));
}

export async function getFinanceSnapshot(userId?: string) {
  return readFinanceSnapshot(await requireUserId(userId));
}
export async function commitFinance(input: unknown) {
  const owner = await requireUserId(undefined, "write");
  return moneyAction(() => writeMobileFinance(owner, input), () => readFinanceSnapshot(owner));
}
// Older open tabs lack a revision and stable operation ID. Never fall back to a
// last-write-wins mutation; a reload opens the current, retry-safe editor.
const legacyMessage = "Reload Finance before making this change. Your older editor cannot safely save it.";
export async function createFinanceCategory(_input: unknown) { void [_input]; return { success: false as const, message: legacyMessage }; }
export async function removeFinanceCategory(_input: unknown) { void [_input]; return { success: false as const, message: legacyMessage }; }
export async function restoreFinanceCategory(_input: unknown) { void [_input]; return { success: false as const, message: legacyMessage }; }
export async function saveFinanceEntry(_id: string | null, _input: unknown) { void [_id, _input]; return { success: false as const, message: legacyMessage }; }
export async function addExpens(_prevState: unknown, _formData: FormData) { void [_prevState, _formData]; return { success: false as const, message: legacyMessage }; }
export async function addIncome(_prevState: unknown, _formData: FormData) { void [_prevState, _formData]; return { success: false as const, message: legacyMessage }; }

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

export async function removeListItem(_id: string) { void [_id]; return { success: false as const, message: legacyMessage }; }
export async function updateListItem(_id: string, _category: string, _value: string) { void [_id, _category, _value]; return { success: false as const, message: legacyMessage }; }

export async function getChartIncomeOutcomeData(
  userId: string,
  onlyCurrentMonth?: boolean
) {
  return (await getChartIncomeOutcomeSnapshot(userId, onlyCurrentMonth)).data;
}

export async function getChartIncomeOutcomeSnapshot(
  userId: string,
  onlyCurrentMonth?: boolean
) {
  userId = await requireUserId(userId);

  const preferences=(await accountSettings(userId)).preferences;
  const currency=preferences.financeDefaultCurrency;
  const conditions = [
    eq(financeTable.userId, userId),eq(financeTable.currency,currency),
  ];

  if (onlyCurrentMonth) {
    const month=dateInZone(new Date(),preferences.timezone).slice(0,7);
    conditions.push(sql`to_char(${financeTable.date}, 'YYYY-MM') = ${month}`);
  }

  const data = await db
    .select({
      month: sql<string>`to_char(${financeTable.date}, 'YYYY-MM')`,
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
    .groupBy(sql`to_char(${financeTable.date}, 'YYYY-MM')`)
    .orderBy(sql`MIN(${financeTable.date})`);

  return {currency, data: data.map((row) => ({
    month: row.month.trim(),
    income: Number(row.income ?? 0),
    outcome: -Math.abs(Number(row.outcome ?? 0)),
  }))};
}

