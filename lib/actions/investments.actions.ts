"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "../db/drizzle";
import { investmentPositions } from "../db/schema";
import { requireUserId } from "../session";
import { investmentPositionSchemaForZone, serializePosition } from "../investments";
import { accountSettings } from "../account/store";
import { getCryptoMarket, investmentMarket } from "../investment-market";
import catalog from "../data/crypto-catalog.json";

export async function getInvestmentPositions() {
  const owner = await requireUserId();
  const rows = await db.select().from(investmentPositions).where(and(eq(investmentPositions.userId, owner), eq(investmentPositions.archived, false))).orderBy(desc(investmentPositions.boughtOn));
  return rows.map(serializePosition);
}
export async function refreshInvestmentMarket() {
  return investmentMarket(await getInvestmentPositions());
}
export async function saveInvestmentPosition(id: string | null, input: unknown) {
  try {
    const owner = await requireUserId(undefined,"write");
    const settings = await accountSettings(owner);
    const parsed = investmentPositionSchemaForZone(settings.preferences.timezone).safeParse(input);
    if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
    if (id !== null && (typeof id !== "string" || !id.trim())) return { success: false as const, message: "Position not found" };
    const data = parsed.data;
    if(id){const legacy=(await db.select().from(investmentPositions).where(and(eq(investmentPositions.id,id),eq(investmentPositions.userId,owner))))[0];if(legacy&&legacy.currency!=="USD")return {success:false as const,message:"Legacy non-USD records are preserved. Contact support for explicit migration; they cannot be relabeled."};}
    let name = data.name, symbol = data.symbol;
    if (data.kind === "crypto") {
      let assets = catalog.assets;
      try { assets = (await getCryptoMarket()).assets; } catch { /* The bundled catalog works during outages. */ }
      const asset = assets.find((asset) => asset.id === data.assetId) || catalog.assets.find((asset) => asset.id === data.assetId);
      if (!asset) {
        const existing = id ? await db.select().from(investmentPositions).where(and(eq(investmentPositions.id, id), eq(investmentPositions.userId, owner), eq(investmentPositions.archived, false))) : [];
        if (!existing[0] || existing[0].assetId !== data.assetId || existing[0].kind !== "crypto") return { success: false as const, message: "Choose an asset from the crypto list" };
        name = existing[0].name; symbol = existing[0].symbol;
      } else { name = asset.name; symbol = asset.symbol; }
    }
    const manualPrice = data.kind === "other" && data.manualPrice !== "" ? data.manualPrice : null;
    const values = { currency:"USD",kind: data.kind, assetId: data.kind === "crypto" ? data.assetId : null, name, symbol, buyPrice: data.buyPrice, quantity: data.quantity, boughtOn: data.boughtOn, manualPrice, manualPriceAt: manualPrice !== null ? new Date() : null };
    const rows = id === null ? await db.insert(investmentPositions).values({ ...values, id: crypto.randomUUID(), userId: owner }).returning() : await db.update(investmentPositions).set(values).where(and(eq(investmentPositions.id, id), eq(investmentPositions.userId, owner), eq(investmentPositions.archived, false))).returning();
    if (!rows[0]) return { success: false as const, message: "Position not found" };
    revalidatePath("/account/investments");
    return { success: true as const, position: serializePosition(rows[0]), message: id ? "Position updated" : "Position added" };
  } catch { return { success: false as const, message: "Could not save. Your details are still here; please try again." }; }
}
export async function archiveInvestmentPosition(id: string, archived: boolean) {
  try {
    const owner = await requireUserId(undefined,"write");
    if (typeof id !== "string" || !id.trim() || typeof archived !== "boolean") return { success: false as const, message: "Position not found" };
    const rows = await db.update(investmentPositions).set({ archived }).where(and(eq(investmentPositions.id, id), eq(investmentPositions.userId, owner))).returning();
    if (!rows[0]) return { success: false as const, message: "Position not found" };
    revalidatePath("/account/investments");
    return { success: true as const, position: serializePosition(rows[0]) };
  } catch { return { success: false as const, message: "Could not change this position. Please try again." }; }
}
