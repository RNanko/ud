import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode } from "./helpers.mjs";

const { financeCsv, financeCsvFilename } = loadModule("lib/finance-csv.ts");
const entry = { id: "one", date: "2026-10-03", amount: "12.5", type: "-", category: "Food", subcategory: null, comment: null };

test("CSV preserves dates, types, cents, Unicode and quoted multiline text without modifying records", () => {
  const rows = [{ ...entry, category: "Food, drinks", subcategory: 'Café "Central"', comment: 'First line\nSecond, "quoted" line' }, { ...entry, id: "two", type: "+", amount: "0.10" }];
  const before = JSON.stringify(rows), csv = financeCsv(rows);
  assert.ok(csv.startsWith("\uFEFFDate,Type,Category,Detail,Amount,Currency,Note,ID\r\n"));
  assert.ok(csv.includes('"2026-10-03","Spending","Food, drinks","Café ""Central""",12.50,"Currency not recorded","First line\nSecond, ""quoted"" line","one"\r\n'));
  assert.ok(csv.includes('"Revenue","Food","",0.10,"Currency not recorded","","two"\r\n'));
  assert.equal(JSON.stringify(rows), before);
  assert.equal(csv.includes("userId"), false);
});

test("CSV treats formula-like user text as literal text, including whitespace and tab prefixes", () => {
  for (const payload of ['=HYPERLINK("https://example.com")', "+1+2", "-1+2", "@SUM(1)", "  =1+2", "\t=1+2", "\r=1+2", "\nplain text"]) {
    const csv = financeCsv([{ ...entry, category: payload, subcategory: payload, comment: payload }]);
    assert.equal(csv.split(`"'${payload.replaceAll('"', '""')}"`).length - 1, 3);
    assert.equal(csv.includes(",12.50,"), true);
  }
});

test("CSV exports every supplied row in order and names the file from the complete date range", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ ...entry, id: `row-${index}`, date: index === 24 ? "2024-01-23" : "2026-08-30" }));
  const csv = financeCsv(rows);
  assert.equal(csv.trimEnd().split("\r\n").length, 26);
  assert.ok(csv.indexOf('"row-0"') < csv.indexOf('"row-24"'));
  assert.equal(financeCsvFilename(rows), "finance-history-2024-01-23-to-2026-08-30.csv");
  assert.equal(financeCsv([]), "\uFEFFDate,Type,Category,Detail,Amount,Currency,Note,ID\r\n");
});

test("History downloads all filtered pages, respects sorting and disables empty or busy exports", async () => {
  const hooks = hookHarness(), downloads = [], revoked = [];
  let busy = false, fail = false, pendingBlob, cleanup;
  const component = loadModule("app/(main)/account/finance/FinanceHistory.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "lucide-react": {},
    "@/app/components/ui/button": {}, "@/app/components/ui/input": {},
    "@/app/components/ui/dropdown-menu": {}, "./FinanceSelect": {},
    "@/lib/finance": loadModule("lib/finance.ts"),
    "@/lib/finance-csv": { financeCsv, financeCsvFilename },
  }, {
    Blob,
    URL: {
      createObjectURL(blob) { if (fail) throw Error("Unavailable"); pendingBlob = blob; return "blob:csv-test"; },
      revokeObjectURL: url => revoked.push(url),
    },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ click() { downloads.push({ blob: pendingBlob, name: this.download }); }, remove() {} }),
    },
    window: { setTimeout: fn => { cleanup = fn; } },
  }).default;
  const rows = Array.from({ length: 25 }, (_, i) => ({ ...entry, id: `row-${i}`, category: i < 20 ? "Food" : "Bills", amount: `${i + 1}`, subcategory: "Lunch", currency: ["USD", "GBP", "NONE", null][i % 4] }));
  const render = () => hooks.render(() => component({ entries: rows, busy, onEdit() {}, onMove() {}, onDelete() {} }));
  const button = () => findNode(render(), node => node.props?.title?.startsWith("Download all")).props;
  const select = label => findNode(render(), node => node.props?.label === label).props;
  select("Filter category").onValueChange("Food");
  select("Sort transactions").onValueChange("largest");
  findNode(render(), node => node.props?.["aria-label"] === "Next history page").props.onClick();
  button().onClick();
  const csv = await downloads[0].blob.text();
  assert.equal(csv.trimEnd().split("\r\n").length, 21);
  assert.ok(csv.indexOf('"row-19"') < csv.indexOf('"row-0"'));
  assert.equal(csv.includes('"Bills"'), false);
  for (const currency of ["USD", "GBP", "Numbers only", "Currency not recorded"]) assert.ok(csv.includes(`"${currency}"`));
  assert.equal(downloads[0].name, "finance-history-2026-10-03-to-2026-10-03.csv");
  cleanup(); assert.deepEqual(revoked, ["blob:csv-test"]);
  select("Filter transaction type").onValueChange("+");
  assert.equal(button().disabled, true); button().onClick(); assert.equal(downloads.length, 1);
  select("Filter transaction type").onValueChange("all");
  busy = true; assert.equal(button().disabled, true); button().onClick(); assert.equal(downloads.length, 1);
  busy = false; fail = true; button().onClick();
  assert.equal(findNode(render(), node => node.props?.role === "alert").props.children, "Could not download CSV. Please try again.");
  fail = false; button().onClick(); assert.equal(downloads.length, 2);
  assert.equal(findNode(render(), node => node.props?.role === "alert"), undefined);
});
