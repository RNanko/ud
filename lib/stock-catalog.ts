export type StockAsset = { symbol: string; name: string; type: "Stock" | "ETF" };
/** A curated shortcut list, not a live ranking. Quotes come from the existing market provider. */
export const stockCatalog: StockAsset[] = [
  { symbol: "AAPL", name: "Apple", type: "Stock" },
  { symbol: "MSFT", name: "Microsoft", type: "Stock" },
  { symbol: "NVDA", name: "NVIDIA", type: "Stock" },
  { symbol: "AMZN", name: "Amazon", type: "Stock" },
  { symbol: "GOOGL", name: "Alphabet", type: "Stock" },
  { symbol: "META", name: "Meta Platforms", type: "Stock" },
  { symbol: "TSLA", name: "Tesla", type: "Stock" },
  { symbol: "AVGO", name: "Broadcom", type: "Stock" },
  { symbol: "AMD", name: "Advanced Micro Devices", type: "Stock" },
  { symbol: "NFLX", name: "Netflix", type: "Stock" },
  { symbol: "COST", name: "Costco Wholesale", type: "Stock" },
  { symbol: "QCOM", name: "Qualcomm", type: "Stock" },
  { symbol: "SPY", name: "State Street SPDR S&P 500 ETF Trust", type: "ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ ETF", type: "ETF" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Morningstar Total Stock Market ETF", type: "ETF" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "ETF" },
  { symbol: "DIA", name: "State Street SPDR Dow Jones Industrial Average ETF Trust", type: "ETF" },
];
export function searchStockCatalog(search: string) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return stockCatalog.filter(asset => terms.every(term => `${asset.symbol} ${asset.name} ${asset.type}`.toLowerCase().includes(term)));
}
