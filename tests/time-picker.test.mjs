import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";
const timing = loadModule("lib/planner-time.ts");

function picker(value, options = {}) {
  const hooks = hookHarness(), writes = [];
  const { TimePicker } = loadModule("app/components/ui/time-picker.tsx", {
    react: { ...hooks.react, useId: () => "clock" }, "react/jsx-runtime": jsxRuntime,
    "lucide-react": {}, "./button": { Button: "Button" },
    "./popover": { Popover: "Popover", PopoverTrigger: "Trigger", PopoverContent: "Content" },
    "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
  });
  const render = () => hooks.render(() => TimePicker({ label: "Time", value, onChange: next => { value = next; writes.push(next); }, ...options }));
  const button = label => findNode(render(), node => node.props?.["aria-label"] === label).props;
  return { render, button, writes, value: () => value };
}

test("12-hour choices preserve HH:mm storage across midnight, noon and minute changes", () => {
  const state = picker("23:07", { hour12: true });
  const period = value => findNode(state.render(), node => node.type === "button" && node.props.children === value).props;
  period("AM").onClick(); assert.equal(state.value(), "11:07");
  state.button("Hour 12").onClick(); assert.equal(state.value(), "00:07");
  period("PM").onClick(); assert.equal(state.value(), "12:07");
  state.button("Minute 59").onClick(); assert.equal(state.value(), "12:59");
  state.button("Minute 15").onClick(); assert.equal(state.value(), "12:15");
  assert.ok(state.writes.every(value => timing.timingSchema.safeParse({ start: value, duration: null, overnight: false }).success));
});

test("24-hour picker keeps exact minutes and optional values remain empty until selected", () => {
  const state = picker("", { optional: true, defaultValue: "19:00" });
  findNode(state.render(), node => node.type === "Popover").props.onOpenChange(true);
  assert.deepEqual(state.writes, []);
  state.button("Hour 23").onClick(); state.button("Minute 04").onClick();
  assert.equal(state.value(), "23:04");
  findNode(state.render(), node => node.type === "Button" && node.props.children === "Clear time").props.onClick();
  assert.equal(state.value(), "");
  assert.equal(findNode(state.render(), node => node.type === "Popover").props.open, false);
});

test("arrow keys wrap within a column; Home and End select boundaries", () => {
  const state = picker("18:00"), selected = [];
  const buttons = [0, 1, 2].map(index => ({ focus() {}, click() { selected.push(index); } }));
  const group = findNode(state.render(), node => node.props?.["aria-label"] === "Time hour").props;
  const key = (key, index) => group.onKeyDown({ key, target: buttons[index], currentTarget: { querySelectorAll: () => buttons }, preventDefault() {} });
  key("ArrowUp", 0); key("ArrowDown", 2); key("Home", 1); key("End", 0);
  assert.deepEqual(selected, [2, 0, 0, 2]);
});

test("timing fields use the saved clock format, derive duration and preserve overnight validation", () => {
  const hooks = hookHarness();
  let value = { start: "23:30", duration: null, overnight: true };
  const TimingFields = loadModule("app/(main)/account/events/TimingFields.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "lucide-react": {},
    "motion/react": { AnimatePresence: "Presence", motion: { div: "div", label: "label", p: "p" } },
    "../gym/GymUI": { NumberField: "Number" }, "../finance/FinanceSelect": "Select",
    "@/app/components/ui/time-picker": { TimePicker: "Time" },
    "@/hooks/use-account-calendar": { useAccountCalendar: () => ({ hour12: true }) },
    "@/lib/planner-time": timing,
  }).default;
  const render = () => hooks.render(() => TimingFields({ value, onChange: next => { value = next; } }));
  const field = label => findNode(render(), node => node.props?.label === label).props;
  assert.equal(field("Start time").hour12, true);
  field("End time (optional)").onChange("00:15");
  assert.equal(value.duration, 45);
  assert.equal(timing.timingSchema.safeParse(value).success, true);
  assert.equal(field("End time (optional)").value, "00:15");
  field("End time (optional)").onChange("");
  assert.equal(value.duration, null);
  field("Start time").onChange("10:03");
  assert.equal(value.start, "10:03");
  assert.deepEqual(plain(value), { start: "10:03", duration: null, overnight: true });
});
