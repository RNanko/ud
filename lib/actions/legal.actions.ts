"use server";
import { requireUserId } from "../session";
import { actionResult } from "../account/result";
import { legalAccountHistory } from "../legal/store";
export async function getMyLegalHistory() {
  return actionResult(async () => legalAccountHistory(await requireUserId()));
}
