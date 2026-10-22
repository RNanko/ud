import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadModule, plain } from "./helpers.mjs";
const currencies = loadModule("lib/finance-currencies.ts");
const preferences = loadModule("lib/account/preferences.ts");
const web = loadModule("types/validators.ts").financeEntrySchema;
const mobile = loadModule("lib/mobile/finance-contract.ts").financeWriteSchema;
const finance = loadModule("lib/finance.ts");
const draft = { type: "+", amount: "0.10", date: "2026-10-05", category: "Salary" };

test('dashboard selects recorded currencies and a populated month without mixing totals',()=>{
 const records=[{...draft,id:'usd',date:'2024-01-05',currency:'USD',amount:'100'}, {...draft,id:'eur',date:'2024-02-05',currency:'EUR',amount:'200'}];
 const original=JSON.stringify(records);
 let result=finance.financeDashboardSelection(records,'PLN',null,'2026-10');
 assert.equal(result.entries.length,1);assert.equal(result.month,'2024-02');
 assert.deepEqual(plain(result.currencies),['EUR','USD']);
 result=finance.financeDashboardSelection(records,'USD',null,'2026-10');
 assert.equal(result.currency,'USD');assert.equal(result.month,'2024-01');
 result=finance.financeDashboardSelection(records,'USD','EUR','2024-01');
 assert.equal(result.month,'2024-02');assert.equal(finance.summarizeFinance(result.entries).revenue,200);
 result=finance.financeDashboardSelection(records,'USD','EUR','all');
 assert.equal(result.month,'all');assert.equal(result.entries.length,1);
 result=finance.financeDashboardSelection(records.filter(row=>row.currency==='USD'),'USD','EUR','2024-02');
 assert.equal(result.currency,'USD');assert.equal(result.entries.length,1);
 assert.equal(JSON.stringify(records),original);
});

test('dashboard keeps missing currency separate from numbers-only, including a genuinely empty account',()=>{
 const records=[{...draft,id:'unknown',currency:null},{...draft,id:'numbers',currency:'NONE'}];
 let result=finance.financeDashboardSelection(records,'USD','unassigned','2026-10');
 assert.equal(result.entries[0].id,'unknown');assert.equal(result.entries.length,1);
 result=finance.financeDashboardSelection(records,'USD','NONE','2026-10');
 assert.equal(result.entries[0].id,'numbers');
 result=finance.financeDashboardSelection([],'PLN',null,'2026-10');
 assert.equal(result.currency,'PLN');assert.equal(result.entries.length,0);
});

test("all currency choices and numbers-only pass both web and mobile save validation; defaults start USD", () => {
  assert.equal(preferences.defaultPreferences.financeDefaultCurrency, "USD");
  assert.equal(currencies.financeCurrencies[0], "USD");
  for (const currency of currencies.financeCurrencies) {
    assert.equal(preferences.preferenceSchema.safeParse({ ...preferences.defaultPreferences, financeDefaultCurrency: currency }).success, true, currency);
    assert.equal(web.safeParse({ ...draft, currency }).success, true, currency);
    assert.equal(mobile.safeParse({ operationId: randomUUID(), revision: 0, data: { kind: "entry", id: randomUUID(), create: true, entry: { ...draft, currency } } }).success, true, currency);
  }
  for (const currency of ["BTC", "CUSTOM", "", "invalid"]) assert.equal(web.safeParse({ ...draft, currency }).success, false);
});

test("numbers-only records retain their identity and exact totals separately from real and legacy currencies", () => {
  const records = [
    { ...draft, id: "a", currency: "NONE" }, { ...draft, id: "b", currency: "NONE", amount: "0.20" },
    { ...draft, id: "c", currency: "USD", amount: "800" }, { ...draft, id: "d", currency: "CAD", amount: "900" },
    { ...draft, id: "legacy", currency: null, amount: "999" },
  ];
  const selected = finance.filterFinance(records, { currency: "NONE" });
  assert.deepEqual(plain(selected.map(record => record.id)), ["a", "b"]);
  assert.equal(finance.summarizeFinance(selected).revenue, .3);
  assert.throws(() => finance.summarizeFinance(records), /one currency/);
  assert.equal(finance.serializeFinanceEntry({ ...records[0], subcategory: null, comment: null }).currency, "NONE");
  assert.match(currencies.financeCurrencyLabel("NONE"), /numbers only/);
  assert.match(currencies.financeCurrencyLabel(null), /not recorded/);
  const csv = loadModule("lib/finance-csv.ts").financeCsv(selected);
  assert.ok(csv.includes('"Numbers only"'));
  assert.ok(!csv.includes("NONE"));
});

test("mixed history groups exact balances by currency and retains unassigned records", () => {
  const records = [
    { ...draft, id: "a", currency: "USD" },
    { ...draft, id: "b", currency: "USD", amount: "0.20" },
    { ...draft, id: "c", currency: "GBP", type: "-", amount: "2.50" },
    { ...draft, id: "d", currency: "NONE", amount: "12.34" },
    { ...draft, id: "e", currency: null, amount: "99.99" },
  ];
  const original = JSON.stringify(records);
  const groups = finance.summarizeFinanceByCurrency(records);
  assert.deepEqual(plain(groups.map(({ currency, balance }) => ({ currency, balance }))), [
    { currency: "USD", balance: .3 }, { currency: "GBP", balance: -2.5 },
    { currency: "NONE", balance: 12.34 }, { currency: null, balance: 99.99 },
  ]);
  assert.equal(JSON.stringify(records), original);
  assert.deepEqual(plain(finance.summarizeFinanceByCurrency([])), []);
});

test("explicit currency edits validate supported values while older edits retain legacy values and request hashes", () => {
  const data = { kind: 'entry', id: 'existing-record', create: false, entry: { ...draft, currency: null } };
  const envelope = { operationId: randomUUID(), revision: 3, data };
  const older = mobile.parse(envelope);
  assert.equal(Object.hasOwn(older.data, 'changeCurrency'), false);
  for (const currency of currencies.financeCurrencies) assert.equal(mobile.safeParse({ ...envelope, data: { ...data, changeCurrency: true, entry: { ...draft, currency } } }).success, true, currency);
  for (const currency of [null, 'BTC', '', 'invalid']) assert.equal(mobile.safeParse({ ...envelope, data: { ...data, changeCurrency: true, entry: { ...draft, currency } } }).success, false);
});
