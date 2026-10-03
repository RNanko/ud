import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, jsxRuntime, hookHarness, findNode } from "./helpers.mjs";

test("shared selectors ignore native resets while preserving empty and special-character options", () => {
  const changes = [];
  const Select = "Select";
  const FinanceSelect = loadModule("app/(main)/account/finance/FinanceSelect.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/app/components/ui/select": { Select, SelectTrigger: "trigger", SelectValue: "value", SelectContent: "content", SelectGroup: "group", SelectItem: "item", SelectLabel: "label", SelectSeparator: "separator" },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  }).default;
  const options = ["", 'Chest "A"', "option:literal", "日本語"];
  const tree = FinanceSelect({ label: "Category", title: "Categories", icon: "icon", value: "", options: options.map(value => ({ value, label: value || "All" })), onValueChange: value => changes.push(value) });
  const select = findNode(tree, node => node.type === Select);
  for (const reset of ["", "undefined", "{", "option:unknown"]) assert.doesNotThrow(() => select.props.onValueChange(reset));
  assert.deepEqual(changes, []);
  for (const value of options) {
    const item = findNode(tree, node => node.type === "item" && node.props.children[1] === (value || "All"));
    select.props.onValueChange(item.props.value);
  }
  assert.deepEqual(changes, options);
});

test("Recent wins starts collapsed and removes result links immediately when closed", () => {
  const harness = hookHarness();
  const RecentWins = loadModule("app/(main)/account/momentum/RecentWins.tsx", {
    "react": { ...harness.react, useId: () => "wins-panel" },
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { Check: "check", ChevronDown: "down", ChevronUp: "up", Sparkles: "sparkles" },
    "@/lib/gym/dates": { dateLabel: value => value },
    "./MomentumUI": { Action: "button", Empty: "empty", Panel: "panel", SourceLink: "link" },
  }).default;
  const render = () => harness.render(() => RecentWins({ wins: [{ key: "task:1", title: "A real result", detail: "Task", date: null, completedAt: "2026-10-03T10:00:00Z" }], milestones: 1 }));
  let tree = render();
  const toggle = () => findNode(tree, node => node.type === "button");
  assert.equal(toggle().props["aria-expanded"], false);
  assert.equal(findNode(tree, node => node.type === "link"), undefined);
  toggle().props.onClick(); tree = render();
  assert.equal(toggle().props["aria-expanded"], true);
  assert.ok(findNode(tree, node => node.type === "link"));
  assert.ok(findNode(tree, node => node.props?.children?.includes?.("completion date unknown")));
  toggle().props.onClick(); tree = render();
  assert.equal(toggle().props["aria-expanded"], false);
  assert.equal(findNode(tree, node => node.type === "link"), undefined);
  assert.equal(findNode(tree, node => node.props?.id === "wins-panel").props.hidden, true);
});
