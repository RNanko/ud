import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findNode, hookHarness, jsxRuntime, loadModule, plain } from "./helpers.mjs";

const lib = loadModule("lib/investments.ts");
const catalog = JSON.parse(readFileSync("lib/data/crypto-catalog.json", "utf8"));
const draft = { kind: "crypto", assetId: "bitcoin", symbol: "BTC", name: "Bitcoin", currency: "USD", buyPrice: "50000", quantity: "0.01", boughtOn: "2026-01-01", manualPrice: "" };
const position = (changes = {}) => ({ ...draft, id: "btc", manualPrice: null, manualPriceAt: null, ...changes });
const quote = (price, source = "CoinGecko") => ({ price, source, status: "market", at: "2026-10-01T00:00:00Z" });
const filters = { search: "", kind: "all", performance: "all", from: "", to: "", sort: "newest" };

test("crypto lots calculate fractional holdings and each purchase cost independently", () => {
  const quotes = { "crypto:bitcoin": quote(60000) };
  const rows = [position(), position({ id: "second", buyPrice: "65000", quantity: "0.02" })].map((p) => lib.valuePosition(p, quotes));
  assert.equal(rows[0].cost, 500); assert.equal(rows[0].value, 600); assert.equal(rows[0].profit, 100); assert.equal(rows[0].percent, 20);
  assert.equal(rows[1].profit, -100);
  assert.deepEqual(plain(lib.summarizeInvestments(rows)), { cost: 1800, value: 1800, profit: 0, percent: 0, priced: 2, count: 2, unsupported: 0 });
});

test("unavailable quotes never become zero or a fabricated loss in portfolio totals", () => {
  const rows = [lib.valuePosition(position(), { "crypto:bitcoin": quote(60000) }), lib.valuePosition(position({ id: "missing", assetId: "missing" }), {})];
  assert.equal(rows[1].value, null); assert.equal(rows[1].profit, null);
  const totals = lib.summarizeInvestments(rows);
  assert.equal(totals.cost, 1000); assert.equal(totals.value, 600); assert.equal(totals.profit, 100); assert.equal(totals.percent, 20); assert.equal(totals.priced, 1);
  assert.equal(lib.summarizeInvestments([rows[1]]).value, null);
  assert.equal(lib.valuePosition(position(), { "crypto:bitcoin": quote(NaN) }).value, null);
});

test("manual zero valuation is valid and overrides a stock quote with a full loss", () => {
  const row = lib.valuePosition(position({ kind: "other", symbol: "AAPL", manualPrice: "0", buyPrice: "200", quantity: "3" }), { "other:AAPL": quote(300, "Yahoo Finance") });
  assert.equal(row.value, 0); assert.equal(row.profit, -600); assert.equal(row.percent, -100); assert.equal(row.quote.source, "Manual");
  assert.equal(lib.valuePosition(position({ manualPrice: "0" }), { "crypto:bitcoin": quote(60000) }).value, 600);
});

test("dashboard combines search, type, inclusive dates, performance and sort without changing source rows", () => {
  const rows = [lib.valuePosition(position(), { "crypto:bitcoin": quote(60000) }), lib.valuePosition(position({ id: "loss", kind: "other", symbol: "AAPL", name: "Apple", boughtOn: "2026-02-01", buyPrice: "200", quantity: "3" }), { "other:AAPL": quote(180) }), lib.valuePosition(position({ id: "missing", assetId: "missing", boughtOn: "2026-03-01" }), {})];
  assert.deepEqual(plain(lib.filterInvestments(rows, { ...filters, search: " apple ", kind: "other", performance: "loss", from: "2026-02-01", to: "2026-02-01" }).map((row) => row.position.id)), ["loss"]);
  assert.deepEqual(plain(lib.filterInvestments(rows, { ...filters, performance: "gain" }).map((row) => row.position.id)), ["btc"]);
  assert.deepEqual(plain(lib.filterInvestments(rows, { ...filters, performance: "unpriced" }).map((row) => row.position.id)), ["missing"]);
  assert.deepEqual(plain(lib.filterInvestments(rows, { ...filters, sort: "profit" }).map((row) => row.position.id)), ["btc", "loss", "missing"]);
  assert.deepEqual(rows.map((row) => row.position.id), ["btc", "loss", "missing"]);
});

test("purchase validation rejects invalid quantities, prices, dates and excessive exposure", () => {
  for (const change of [{ buyPrice: "0" }, { quantity: "-1" }, { quantity: "1e3" }, { buyPrice: "NaN" }, { buyPrice: "Infinity" }, { quantity: "0.0000000000001" }, { boughtOn: "2026-02-30" }, { boughtOn: "2999-01-01" }, { assetId: null }, { buyPrice: "1000000000000", quantity: "1000000000000" }]) assert.equal(lib.investmentPositionSchema.safeParse({ ...draft, ...change }).success, false, JSON.stringify(change));
  assert.equal(lib.investmentPositionSchema.safeParse({ ...draft, quantity: "0.000000000001" }).success, true);
  assert.equal(lib.investmentPositionSchema.safeParse({ ...draft, kind: "other", symbol: "INVALID/URL" }).success, false);
});

test("all 200 catalog tickers, including Unicode and underscores, can be selected", () => {
  assert.equal(catalog.assets.length, 200); assert.equal(new Set(catalog.assets.map((a) => a.id)).size, 200);
  for (const asset of catalog.assets) assert.equal(lib.investmentPositionSchema.safeParse({ ...draft, assetId: asset.id, symbol: asset.symbol, name: asset.name }).success, true, asset.symbol);
});

function fixture({ owner = "alice", rows = [position()], fail = false } = {}) {
  const writes = [], paths = [];
  const query = { from() { return this; }, where(condition) { writes.push({ condition }); return this; }, set(values) { writes.push({ values }); return this; }, values(values) { writes.push({ values }); return this; }, returning: async () => { if (fail) throw new Error("DB failed"); return rows; }, orderBy: async () => rows, then(resolve) { resolve(rows); } };
  const db = Object.fromEntries(["select", "insert", "update", "delete"].map((operation) => [operation, () => { writes.push({ operation }); return query; }]));
  const orm = { eq: (column, value) => ({ column, value }), and: (...conditions) => ({ conditions }), desc: (column) => column };
  const actions = loadModule("lib/actions/investments.actions.ts", {
    "drizzle-orm": orm, "next/cache": { revalidatePath: (path) => paths.push(path) }, "../db/drizzle": db,
    "../db/schema": { investmentPositions: { id: "id", userId: "owner", archived: "archived", boughtOn: "date" } },
    "../session": { requireUserId: async () => { if (!owner) throw new Error("Unauthorized"); return owner; } },
    "../investments": lib, "../investment-market": { getCryptoMarket: async () => ({ assets: catalog.assets }), investmentMarket: async (positions) => ({ positions }) }, "../data/crypto-catalog.json": catalog,
  });
  return { actions, writes, paths };
}

test("unversioned investment saves and archive/restore fail closed without DB writes", async () => {
  const {actions,writes,paths}=fixture();
  for(const result of await Promise.all([actions.saveInvestmentPosition(null,draft),actions.saveInvestmentPosition("owned",draft),actions.archiveInvestmentPosition("owned",true),actions.archiveInvestmentPosition("owned",false)])) {
    assert.equal(result.success,false);assert.match(result.message,/Reload Investments/);
  }
  assert.equal(writes.length,0);assert.equal(paths.length,0);
  await assert.rejects(fixture({owner:null}).actions.getInvestmentPositions(),/Unauthorized/);
});

test("read and price-refresh actions load only active positions owned by the session", async () => {
  const { actions, writes } = fixture();
  await actions.getInvestmentPositions(); await actions.refreshInvestmentMarket();
  for (const { condition } of writes.filter((w) => w.condition)) assert.deepEqual(plain(condition), { conditions: [{ column: "owner", value: "alice" }, { column: "archived", value: false }] });
});

function marketFixture(fetcher, clock = Date) {
  return loadModule("lib/investment-market.ts", { "./data/crypto-catalog.json": catalog, "./investments": lib }, { fetch: fetcher, AbortSignal, Date: clock, process: { env: {} } });
}
const marketRows = catalog.assets.map((asset) => ({ ...asset, market_cap_rank: asset.rank, current_price: 60000, last_updated: "2026-10-01T00:00:00Z" }));
const response = (data) => ({ ok: true, json: async () => data });

test("market requests share a cached top 200 response and quote held assets outside the list", async () => {
  const urls = [];
  const market = marketFixture(async (url) => { urls.push(url); return response(url.includes("simple/price") ? { legacy: { usd: 12, last_updated_at: 1790812800 } } : marketRows); });
  await Promise.all([market.getCryptoMarket(), market.getCryptoMarket()]);
  const result = await market.investmentMarket([position({ assetId: "legacy" })]);
  assert.equal(urls.length, 2); assert.equal(result.assets.length, 200); assert.equal(result.catalogLive, true); assert.equal(result.quotes["crypto:legacy"].price, 12);
});

test("provider outages preserve 200 selectable tickers without inventing crypto prices", async () => {
  const market = marketFixture(async () => { throw new Error("offline"); });
  const result = await market.investmentMarket([position()]);
  assert.equal(result.assets.length, 200); assert.equal(result.catalogLive, false); assert.equal(result.quotes["crypto:bitcoin"], undefined); assert.equal(result.warnings.length, 1);
});

test("stock quotes use USD only, retain timestamps and do not request manual valuations", async () => {
  const urls = [];
  const market = marketFixture(async (url) => { urls.push(url); return response(url.includes("coins/markets") ? marketRows : { chart: { result: [{ meta: { currency: url.includes("EUR") ? "EUR" : "USD", regularMarketPrice: 180, regularMarketTime: 1790812800 } }] } }); });
  const result = await market.investmentMarket([position({ kind: "other", symbol: "AAPL" }), position({ kind: "other", symbol: "EUR" }), position({ kind: "other", symbol: "PROPERTY", manualPrice: "0" })]);
  assert.equal(result.quotes["other:AAPL"].price, 180); assert.ok(result.quotes["other:AAPL"].at);
  assert.equal(result.quotes["other:EUR"].price, null); assert.equal(result.quotes["other:EUR"].status, "unavailable");
  assert.equal(urls.some((url) => url.includes("PROPERTY")), false);
});

test("expired provider caches are visibly marked stale when a refresh fails", async () => {
  let now = Date.now(), offline = false;
  class Clock extends Date { static now() { return now; } }
  const market = marketFixture(async (url) => { if (offline) throw new Error("offline"); return response(url.includes("coins/markets") ? marketRows : { chart: { result: [{ meta: { currency: "USD", regularMarketPrice: 180, regularMarketTime: 1790812800 } }] } }); }, Clock);
  const positions = [position(), position({ kind: "other", symbol: "AAPL" })];
  await market.investmentMarket(positions); now += 120001; offline = true;
  const result = await market.investmentMarket(positions);
  assert.equal(result.quotes["crypto:bitcoin"].status, "stale"); assert.equal(result.quotes["other:AAPL"].status, "stale"); assert.equal(result.quotes["other:AAPL"].price, 180);
});

function clientFixture(actions) {
  const hooks = hookHarness();
  const market = { assets: catalog.assets, quotes: { "crypto:bitcoin": quote(60000) }, refreshedAt: "2026-10-01T00:00:00Z", catalogAt: catalog.updatedAt, catalogLive: true, warnings: [] };
  const Client = loadModule("app/(main)/account/investments/InvestmentsClient.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "framer-motion": { motion: { div: "motion" }, useReducedMotion: () => false },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "@/app/components/ui/button": { Button: "button" }, "@/app/components/ui/input": { Input: "input" },
    "@/lib/actions/investments.actions": { refreshInvestmentMarket: async () => market, ...actions }, "@/lib/investments": lib,
    "../finance/FinanceSelect": "select", "../finance/HoldDeleteButton": "hold", "./InvestmentEditor": "editor",
  }).default;
  const render = () => hooks.render(() => Client({ initialRevision: 0, initialPositions: [position()], initialMarket: market }));
  const window = () => findNode(render(), (node) => node.props?.kind === "crypto" && node.props?.rows);
  return { render, window };
}

test("client retains an uncertain create and retries the exact envelope without duplicate concurrent writes", async () => {
  let complete;const commands=[];
  const state=clientFixture({commitInvestment: async command => {commands.push(plain(command));return new Promise(resolve=>{complete=resolve;});}});
  findNode(state.render(),node=>node.type==="button"&&node.props.children?.includes?.("Add crypto")).props.onClick();
  const save=findNode(state.render(),node=>node.type==="editor").props.onSave;
  const pending=save(null,draft);await assert.rejects(save(null,draft),/wait/);assert.equal(commands.length,1);
  complete({success:false,status:"unknown",message:"Save uncertain"});await assert.rejects(pending,/uncertain/);
  assert.equal(state.window().props.rows.length,1);
  assert.equal(findNode(state.render(),node=>node.type==="editor").props.blocked,true);
  const recovery=findNode(state.render(),node=>node.type==="editor").props.recovery;
  recovery.props.onRetry();assert.equal(commands.length,2);assert.deepEqual(commands[1],commands[0]);
  complete({success:true,acknowledgedOperationId:commands[1].operationId,snapshot:{revision:1,positions:[{...position(),archived:false},{...position({id:commands[1].data.id}),archived:false}]}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(state.window().props.rows.length,2);
  assert.equal(findNode(state.render(),node=>node.type==="editor"),undefined);
});

test("client removal offers Undo and restoration keeps the original purchase", async () => {
  const commands=[];const state=clientFixture({commitInvestment:async command=>{commands.push(plain(command));return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:commands.length,positions:[{...position(),archived:command.data.archived}]}};}});
  await state.window().props.onRemove(position());assert.equal(state.window().props.rows.length,0);
  findNode(state.render(),node=>node.type==="button"&&node.props.children==="Undo").props.onClick();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(state.window().props.rows.length,1);assert.equal(state.window().props.rows[0].position.buyPrice,"50000");
  assert.equal(commands[1].revision,1);assert.notEqual(commands[0].operationId,commands[1].operationId);
});

test("investment conflict preserves the draft and latest purchase details until explicit review",async()=>{
  const commands=[];const latest={...position(),quantity:'9',archived:false};
  const state=clientFixture({commitInvestment:async command=>{commands.push(plain(command));return commands.length===1?{success:false,status:'conflict',message:'Newer purchase details',snapshot:{revision:7,positions:[latest]}}:{success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:8,positions:[{...position(),...command.data.position,archived:false}]}};}});
  state.window().props.onEdit(position());let editor=findNode(state.render(),node=>node.type==='editor').props;
  await assert.rejects(editor.onSave(position().id,{...draft,quantity:'6'}),/Newer/);
  editor=findNode(state.render(),node=>node.type==='editor').props;
  assert.equal(editor.position.quantity,position().quantity);assert.equal(editor.blocked,true);assert.equal(state.window().props.rows[0].position.quantity,'9');
  assert.match(editor.recovery.props.draft,/Quantity 6/);assert.match(editor.recovery.props.latest,/Quantity 9/);assert.equal(commands.length,1);
  editor.onClose();assert.ok(findNode(state.render(),node=>node.type==='editor'));
  editor.recovery.props.onRetry();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(commands[1].revision,7);assert.notEqual(commands[1].operationId,commands[0].operationId);assert.deepEqual(commands[1].data,commands[0].data);
  assert.equal(state.window().props.rows[0].position.quantity,'6');assert.equal(findNode(state.render(),node=>node.type==='editor'),undefined);
});

test("archived or deleted investment conflicts preserve input and offer discard without resurrecting the position",async()=>{
  for(const positions of [[{...position(),archived:true}],[]]){
    let calls=0;const state=clientFixture({commitInvestment:async()=>{calls++;return {success:false,status:'conflict',message:'Removed elsewhere',snapshot:{revision:2,positions}};}});
    state.window().props.onEdit(position());await assert.rejects(findNode(state.render(),node=>node.type==='editor').props.onSave(position().id,draft),/Removed/);
    const editor=findNode(state.render(),node=>node.type==='editor').props;assert.equal(editor.blocked,true);assert.equal(editor.recovery.props.canRetry,false);assert.equal(state.window().props.rows.length,0);
    editor.recovery.props.onDiscard();assert.equal(findNode(state.render(),node=>node.type==='editor'),undefined);assert.equal(calls,1);
  }
});
