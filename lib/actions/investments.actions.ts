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
import { takeQuota } from "../account/email/policy";
import { actionResult } from "../account/result";
import { PublicError, publicErrorMessage } from "../account/errors";
import { investmentWriteSchema } from "../mobile/investment-contract";

export async function getInvestmentPositions() {
  return activePositions(await requireUserId());
}
async function activePositions(owner: string) {
  const rows = await db.select().from(investmentPositions).where(and(eq(investmentPositions.userId, owner), eq(investmentPositions.archived, false))).orderBy(desc(investmentPositions.boughtOn));
  return rows.map(serializePosition);
}
export async function refreshInvestmentMarket() {
  return actionResult(async () => {
    const owner = await requireUserId();
    // Database-backed and atomic: tabs, devices and server instances share one
    // account budget. Reject before reading the portfolio or calling providers.
    if (!await takeQuota(`investment-refresh:${owner}`, 1, 120)) {
      throw new PublicError("Prices can be refreshed once every 2 minutes. Your current quotes are still shown.");
    }
    return investmentMarket(await activePositions(owner), { refresh: true });
  });
}
export async function getInvestmentSnapshot() {
  return readInvestmentSnapshot(await requireUserId());
}
export async function commitInvestment(input: unknown) {
  const parsed = investmentWriteSchema.safeParse(input);
  let owner: string;
  try { owner = await requireUserId(undefined, parsed.success && parsed.data.data.kind === "archive" && parsed.data.data.archived ? "read" : "write"); }
  catch (error) {
    if (error instanceof PublicError && error.code === "MEMBERSHIP_READ_ONLY") return { success: false as const, status: "rejected" as const, message: publicErrorMessage(error) };
    throw error;
  }
  return moneyAction(() => writeMobileInvestment(owner, input), () => readInvestmentSnapshot(owner));
}
const legacyMessage = "Reload Investments before making this change. Your older editor cannot safely save it.";
export async function saveInvestmentPosition(_id: string | null, _input: unknown) { void [_id, _input]; return { success: false as const, message: legacyMessage }; }
export async function archiveInvestmentPosition(_id: string, _archived: boolean) { void [_id, _archived]; return { success: false as const, message: legacyMessage }; }
