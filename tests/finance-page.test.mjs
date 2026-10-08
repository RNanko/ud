import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, jsxRuntime, plain } from "./helpers.mjs";

test("Finance resolves the session before loading one owned snapshot and its revision", async () => {
  const calls = [];
  const { Finance } = loadModule("app/(main)/account/finance/Finance.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/lib/session": { requireUserId: async () => { calls.push("session"); return "owner"; } },
    "@/lib/actions/finance.actions": {
      getFinanceSnapshot: async owner => { calls.push(["snapshot", owner]); return {revision:7,entries:[{id:"entry"}],categories:[{name:"Food"}]}; },
    },
    "@/lib/finance": { serializeFinanceEntry: entry => ({ ...entry, serialized: true }) },
    "./FinanceClient": "FinanceClient",
  });
  const tree = await Finance();
  assert.deepEqual(calls, ["session", ["snapshot", "owner"]]);
  assert.equal(tree.props.userId, "owner");
  assert.equal(tree.props.initialRevision, 7);
  assert.deepEqual(plain(tree.props.initialEntries), [{ id: "entry" }]);
  assert.deepEqual(plain(tree.props.initialCategories), [{ name: "Food" }]);
});
