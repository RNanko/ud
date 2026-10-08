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
