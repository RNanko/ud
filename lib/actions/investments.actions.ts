"use server";

import { and, desc, eq } from "drizzle-orm";

import db from "../db/drizzle";
import { investmentPositions } from "../db/schema";
import { requireUserId } from "../session";
import { serializePosition } from "../investments";

import { investmentMarket } from "../investment-market";
import { writeMobileInvestment } from "../mobile/investments";
import { readInvestmentSnapshot } from "../money/snapshots";
import { moneyAction } from "../money/action-result";

export async function getInvestmentPositions() {
  const owner = await requireUserId();
  const rows = await db.select().from(investmentPositions).where(and(eq(investmentPositions.userId, owner), eq(investmentPositions.archived, false))).orderBy(desc(investmentPositions.boughtOn));
  return rows.map(serializePosition);
}
export async function refreshInvestmentMarket() {
  return investmentMarket(await getInvestmentPositions());
}
export async function getInvestmentSnapshot() {
  return readInvestmentSnapshot(await requireUserId());
}
export async function commitInvestment(input: unknown) {
  const owner = await requireUserId(undefined, "write");
  return moneyAction(() => writeMobileInvestment(owner, input), () => readInvestmentSnapshot(owner));
}
const legacyMessage = "Reload Investments before making this change. Your older editor cannot safely save it.";
export async function saveInvestmentPosition(_id: string | null, _input: unknown) { void [_id, _input]; return { success: false as const, message: legacyMessage }; }
export async function archiveInvestmentPosition(_id: string, _archived: boolean) { void [_id, _archived]; return { success: false as const, message: legacyMessage }; }
