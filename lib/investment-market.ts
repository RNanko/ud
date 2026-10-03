import catalog from "./data/crypto-catalog.json";
import { investmentKey, type CryptoAsset, type InvestmentMarket, type InvestmentPosition, type InvestmentQuote } from "./investments";

type CryptoMarket = { assets: CryptoAsset[]; quotes: Record<string, InvestmentQuote>; at: string };
const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const request = fetcher().then((value) => { cache.set(key, { value, expires: Date.now() + 120000 }); return value; }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
async function publicJson(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error("Price provider unavailable");
  return response.json();
}
const cryptoHeaders = (): Record<string, string> => process.env.COINGECKO_DEMO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_DEMO_API_KEY } : {};
const validPrice = (price: unknown): price is number => typeof price === "number" && Number.isFinite(price) && price >= 0;
const validTime = (time: unknown) => typeof time === "string" && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : null;
export async function getCryptoMarket(): Promise<CryptoMarket> {
  return cached("crypto-top-200", async () => {
    const data = await publicJson("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false", cryptoHeaders());
    if (!Array.isArray(data) || data.length < 200) throw new Error("Incomplete crypto catalog");
    const assets: CryptoAsset[] = [], quotes: Record<string, InvestmentQuote> = {};
    for (const row of data.slice(0, 200)) {
      if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.symbol !== "string" || !Number.isFinite(row.market_cap_rank)) throw new Error("Invalid crypto catalog");
      assets.push({ id: row.id, name: row.name, symbol: row.symbol.toUpperCase(), rank: row.market_cap_rank });
      quotes[`crypto:${row.id}`] = { price: validPrice(row.current_price) ? row.current_price : null, at: validTime(row.last_updated), source: "CoinGecko", status: validPrice(row.current_price) ? "market" : "unavailable" };
    }
    return { assets, quotes, at: new Date().toISOString() };
  });
}
export async function investmentMarket(positions: InvestmentPosition[]): Promise<InvestmentMarket> {
  const warnings: string[] = [], quotes: Record<string, InvestmentQuote> = {};
  let assets: CryptoAsset[] = catalog.assets, catalogAt = catalog.updatedAt, catalogLive = false;
  try { const result = await getCryptoMarket(); assets = result.assets; catalogAt = result.at; catalogLive = true; Object.assign(quotes, result.quotes); }
  catch { const saved = cache.get("crypto-top-200")?.value as CryptoMarket | undefined; if (saved) { assets = saved.assets; catalogAt = saved.at; Object.assign(quotes, Object.fromEntries(Object.entries(saved.quotes).map(([key, quote]) => [key, { ...quote, status: "stale" }]))); } warnings.push("Crypto prices could not refresh. The saved ticker list is available."); }
  const missingCrypto = [...new Set(positions.filter((position) => position.kind === "crypto" && position.assetId && !quotes[investmentKey(position)]).map((position) => position.assetId!))];
  if (missingCrypto.length) {
    try {
      const data = await cached(`crypto:${missingCrypto.sort().join(",")}`, () => publicJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(missingCrypto.join(","))}&vs_currencies=usd&include_last_updated_at=true`, cryptoHeaders()));
      for (const id of missingCrypto) if (validPrice(data[id]?.usd)) quotes[`crypto:${id}`] = { price: data[id].usd, at: typeof data[id].last_updated_at === "number" ? new Date(data[id].last_updated_at * 1000).toISOString() : null, source: "CoinGecko", status: "market" };
    } catch { /* Missing prices remain unpriced rather than zero. */ }
  }
  const symbols = [...new Set(positions.filter((position) => position.kind === "other" && position.manualPrice === null).map((position) => position.symbol))];
  // Keep provider concurrency bounded, including on larger portfolios.
  for (let offset = 0; offset < symbols.length; offset += 5) await Promise.all(symbols.slice(offset, offset + 5).map(async (symbol) => {
    const key = `other:${symbol}`;
    try {
      quotes[key] = await cached(key, async () => {
        const data = await publicJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, { "User-Agent": "Mozilla/5.0" });
        const meta = data.chart?.result?.[0]?.meta;
        if (meta?.currency !== "USD" || !validPrice(meta.regularMarketPrice) || !Number.isFinite(meta.regularMarketTime)) throw new Error("No USD quote");
        return { price: meta.regularMarketPrice, at: new Date(meta.regularMarketTime * 1000).toISOString(), source: "Yahoo Finance", status: "market" } as InvestmentQuote;
      });
    } catch {
      const saved = cache.get(key)?.value as InvestmentQuote | undefined;
      quotes[key] = saved ? { ...saved, status: "stale" } : { price: null, at: null, source: "Yahoo Finance", status: "unavailable" };
    }
  }));
  return { assets, catalogAt, catalogLive, quotes, refreshedAt: new Date().toISOString(), warnings };
}
