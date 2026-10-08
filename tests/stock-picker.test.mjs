import test from "node:test";
import assert from "node:assert/strict";
import { findNode, hookHarness, jsxRuntime, loadModule, plain } from "./helpers.mjs";
const catalog = loadModule("lib/stock-catalog.ts");
const investments = loadModule("lib/investments.ts");

test("stock search handles names, tickers, case and multiple terms; every shortcut is a valid investment", () => {
  assert.deepEqual(plain(catalog.searchStockCatalog("  apple  ").map(stock => stock.symbol)), ["AAPL"]);
  assert.deepEqual(plain(catalog.searchStockCatalog("VOO").map(stock => stock.symbol)), ["VOO"]);
  assert.ok(catalog.searchStockCatalog("vanguard ETF").length >= 3);
  assert.equal(catalog.searchStockCatalog("does not exist").length, 0);
  assert.equal(new Set(catalog.stockCatalog.map(stock => stock.symbol)).size, catalog.stockCatalog.length);
  for (const stock of catalog.stockCatalog) assert.equal(investments.investmentPositionSchema.safeParse({ kind: "other", assetId: null, symbol: stock.symbol, name: stock.name, buyPrice: "100", quantity: "0.25", boughtOn: "2026-01-01", manualPrice: "" }).success, true, stock.symbol);
});

test("choosing a stock autofills the form; save submits the selected metadata and retains it after a failed save", async () => {
  const hooks = hookHarness(), drafts = [], stock = catalog.stockCatalog.find(stock => stock.symbol === "VOO");
  const Editor = loadModule("app/(main)/account/investments/InvestmentEditor.tsx", {
    react: { ...hooks.react, useId: () => "id" }, "react/jsx-runtime": jsxRuntime,
    "@radix-ui/react-dialog": new Proxy({}, { get: (_, key) => `Dialog.${String(key)}` }), "@radix-ui/react-popover": {},
    "lucide-react": {}, "@/app/components/ui/button": { Button: "button" }, "@/app/components/ui/input": { Input: "input" },
    "@/lib/investments": investments, "@/hooks/use-account-calendar": { useAccountCalendar: () => ({ timezone: "UTC", localDate: () => "2026-10-05" }) },
    "../finance/FinanceEditor": { financeDialogClass: "dialog" }, "./StockPicker": "StockPicker",
  }, { FormData: class { constructor(data) { this.data = data; } get(key) { return this.data[key] ?? null; } } }).default;
  const render = () => hooks.render(() => Editor({ position: null, initialKind: "other", assets: [], onClose() {}, onSave: async (_id, draft) => { drafts.push(plain(draft)); throw Error("Connection lost"); } }));
  findNode(render(), node => node.type === "StockPicker").props.onChange(stock);
  const field = name => findNode(render(), node => node.props?.name === name);
  assert.equal(field("symbol").props.value, "VOO");
  assert.equal(field("name").props.value, stock.name);
  field("buyPrice").props.onChange({ target: { value: "150.25" } });
  field("quantity").props.onChange({ target: { value: "2" } });
  await findNode(render(), node => node.type === "form").props.onSubmit({ preventDefault() {}, currentTarget: { symbol: field("symbol").props.value, name: field("name").props.value, boughtOn: "2026-01-01" } });
  assert.equal(drafts[0].symbol, "VOO");
  assert.equal(drafts[0].name, stock.name);
  assert.equal(drafts[0].buyPrice, "150.25");
  assert.equal(field("quantity").props.value, "2");
  assert.equal(field("symbol").props.value, "VOO");
  assert.ok(findNode(render(), node => node.props?.role === "alert"));
});
