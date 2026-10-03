import z from "zod";
import { preciseProduct, displayProduct } from "./account/decimal";

export type InvestmentKind = "crypto" | "other";
export type InvestmentPosition = { id: string; currency?: string; kind: InvestmentKind; assetId: string | null; symbol: string; name: string; buyPrice: string; quantity: string; boughtOn: string; manualPrice: string | null; manualPriceAt: string | null };
export type CryptoAsset = { id: string; symbol: string; name: string; rank: number };
export type InvestmentQuote = { price: number | null; at: string | null; source: "CoinGecko" | "Yahoo Finance" | "Manual"; status: "market" | "manual" | "stale" | "unavailable" };
export type InvestmentMarket = { assets: CryptoAsset[]; catalogAt: string; catalogLive: boolean; quotes: Record<string, InvestmentQuote>; refreshedAt: string; warnings: string[] };
const decimal = z.string().trim().regex(/^\d+(\.\d{1,12})?$/, "Use a positive number with up to 12 decimals").refine((value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1e12, "Enter a value between zero and 1 trillion");
export const investmentPositionSchema = z.object({
  kind: z.enum(["crypto", "other"]),
  currency:z.literal("USD").default("USD"),
  assetId: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,149}$/).nullable(),
  symbol: z.string().trim().toUpperCase().min(1, "Enter a ticker").max(50),
  name: z.string().trim().min(1, "Enter an asset name").max(150),
  buyPrice: decimal,
  quantity: decimal,
  boughtOn: z.iso.date("Choose a valid purchase date").refine((value) => value <= new Date().toISOString().slice(0, 10), "Purchase date cannot be in the future"),
  manualPrice: z.union([z.literal(""), z.string().trim().regex(/^\d+(\.\d{1,12})?$/, "Enter a nonnegative valuation").refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e12, "Valuation is too large")]).default(""),
}).refine((value) => value.kind !== "other" || /^[A-Z0-9][A-Z0-9.^=\-]{0,24}$/.test(value.symbol), { message: "Enter a valid ticker", path: ["symbol"] }).refine((value) => value.kind !== "crypto" || !!value.assetId, { message: "Choose a crypto asset", path: ["assetId"] }).refine((value) => Number(value.buyPrice) * Number(value.quantity) <= 1e15, { message: "Position value is too large", path: ["quantity"] });
export type InvestmentDraft = z.input<typeof investmentPositionSchema>;
export const investmentKey = (position: Pick<InvestmentPosition, "kind" | "assetId" | "symbol">) => `${position.kind}:${position.kind === "crypto" ? position.assetId : position.symbol}`;
export function valuePosition(position: InvestmentPosition, quotes: Record<string, InvestmentQuote>) {
  const manual = position.kind === "other" && position.manualPrice !== null;
  const quote: InvestmentQuote | undefined = manual ? { price: Number(position.manualPrice), at: position.manualPriceAt, source: "Manual", status: "manual" } : quotes[investmentKey(position)];
  const price = quote?.price;
  const supported=(position.currency??"USD")==="USD";
  const costUnits=preciseProduct(position.buyPrice,position.quantity);
  const valueUnits=supported&&price!==undefined&&price!==null&&Number.isFinite(price)&&price>=0&&price<=1e12?preciseProduct(price.toFixed(12),position.quantity):null;
  const cost=displayProduct(costUnits),value=valueUnits===null?null:displayProduct(valueUnits),profit=valueUnits===null?null:displayProduct(valueUnits-costUnits);
  return {position,quote:supported?quote:undefined,supported,cost,value,profit,percent:profit===null?null:profit/cost*100,costUnits:costUnits.toString(),valueUnits:valueUnits?.toString()??null};
}
export type ValuedPosition=ReturnType<typeof valuePosition>;
export function summarizeInvestments(rows:ValuedPosition[]){
 const supported=rows.filter(row=>row.supported),priced=supported.filter(row=>row.valueUnits!==null);
 const cost=supported.reduce((sum,row)=>sum+BigInt(row.costUnits),0n),valuedCost=priced.reduce((sum,row)=>sum+BigInt(row.costUnits),0n),value=priced.reduce((sum,row)=>sum+BigInt(row.valueUnits!),0n),profit=value-valuedCost;
 return {cost:displayProduct(cost),value:priced.length?displayProduct(value):null,profit:priced.length?displayProduct(profit):null,percent:valuedCost?Number(profit)/Number(valuedCost)*100:null,priced:priced.length,count:supported.length,unsupported:rows.length-supported.length};
}

export function filterInvestments(rows: ValuedPosition[], filters: { search: string; kind: string; performance: string; from: string; to: string; sort: string }) {
  const search = filters.search.trim().toLocaleLowerCase("en");
  return rows.filter(({ position, profit }) => (!search || `${position.name} ${position.symbol}`.toLocaleLowerCase("en").includes(search)) && (filters.kind === "all" || position.kind === filters.kind) && (!filters.from || position.boughtOn >= filters.from) && (!filters.to || position.boughtOn <= filters.to) && (filters.performance === "all" || filters.performance === "gain" && profit !== null && profit > 0 || filters.performance === "loss" && profit !== null && profit < 0 || filters.performance === "unpriced" && profit === null)).sort((a, b) => filters.sort === "value" ? (b.value ?? -1) - (a.value ?? -1) : filters.sort === "profit" ? (b.profit ?? -Infinity) - (a.profit ?? -Infinity) : filters.sort === "oldest" ? a.position.boughtOn.localeCompare(b.position.boughtOn) : b.position.boughtOn.localeCompare(a.position.boughtOn));
}
export function serializePosition(row: Omit<InvestmentPosition, "kind" | "manualPriceAt"> & { kind: string; manualPriceAt: Date | string | null }) : InvestmentPosition {
  return { id: row.id, currency:row.currency??"USD",kind: row.kind === "crypto" ? "crypto" : "other", assetId: row.assetId, symbol: row.symbol, name: row.name, buyPrice: row.buyPrice, quantity: row.quantity, boughtOn: row.boughtOn, manualPrice: row.manualPrice, manualPriceAt: row.manualPriceAt instanceof Date ? row.manualPriceAt.toISOString() : row.manualPriceAt };
}
export const investmentMoney = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 8 : 2 }).format(value);
export const investmentQuantity = (value: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(Number(value));
