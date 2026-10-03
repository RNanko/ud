import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode } from "./helpers.mjs";
import { blueprint, logic } from "./gym-fixture.mjs";

function notesComponent(hooks) {
  return loadModule("app/(main)/account/gym/GymUI.tsx", {
    react: { ...hooks.react, useId: () => "notes-test" }, "react/jsx-runtime": jsxRuntime,
    "@radix-ui/react-dialog": {}, "framer-motion": { motion: { create: () => "motion-button", div: "motion-div" }, useReducedMotion: () => true },
    "lucide-react": {}, "@/app/components/ui/button": {}, "@/app/components/ui/input": {},
    "@/app/components/ui/textarea": { Textarea: "textarea" }, "../finance/FinanceSelect": {},
    "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
  }).Notes;
}

test("optional notes collapse without clearing saved text and retain an accessible disclosure", () => {
  const hooks = hookHarness(), Notes = notesComponent(hooks);
  let value = "", disabled = false, changes = 0;
  const render = () => hooks.render(() => Notes({ label: "Set 1 notes (optional)", value, disabled, onChange: event => { changes++; value = event.target.value; } }));
  const toggle = () => findNode(render(), node => node.props?.["aria-controls"] === "notes-test-panel").props;
  assert.equal(findNode(render(), node => node.type === "textarea"), undefined);
  assert.equal(toggle()["aria-expanded"], false);
  assert.equal(toggle()["aria-label"], "Add Set 1 notes (optional)");
  toggle().onClick();
  const input = findNode(render(), node => node.type === "textarea").props;
  assert.equal(toggle()["aria-expanded"], true);
  assert.equal(input.id, "notes-test");
  input.onChange({ target: { value: "Kept for next time" } });
  toggle().onClick();
  assert.equal(value, "Kept for next time"); assert.equal(changes, 1);
  assert.equal(toggle()["aria-label"], "Show Set 1 notes (optional)");
  toggle().onClick();
  assert.equal(findNode(render(), node => node.type === "textarea").props.value, value);
  disabled = true;
  assert.equal(findNode(render(), node => node.type === "textarea").props.disabled, true);
  value = ""; assert.equal(render(), null);

  // Existing notes open on first render, including a read-only historical record.
  const fresh = hookHarness(), HistoricalNotes = notesComponent(fresh);
  const historical = fresh.render(() => HistoricalNotes({ label: "Workout notes", value: "Saved notes", disabled: true }));
  assert.equal(findNode(historical, node => node.type === "textarea").props.value, "Saved notes");
  assert.equal(findNode(historical, node => node.props?.["aria-expanded"] === true).props["aria-label"], "Hide Workout notes");
  const editable = hookHarness(), EditableNotes = notesComponent(editable);
  let existing = "Old note";
  const edit = () => editable.render(() => EditableNotes({ label: "Workout notes", value: existing, onChange: event => { existing = event.target.value; } }));
  findNode(edit(), node => node.type === "textarea").props.onChange({ target: { value: "" } });
  assert.equal(findNode(edit(), node => node.type === "textarea").props.value, "");
});

test("workout colors follow confirmed status rather than completed set count, without mutating records", () => {
  const { PlanCard, SessionCard } = loadModule("app/(main)/account/gym/WorkoutCard.tsx", {
    "react/jsx-runtime": jsxRuntime, "lucide-react": {}, "@/lib/gym/logic": logic,
    "@/lib/gym/dates": { dateLabel: date => date }, "./ExerciseIcon": {},
    "./GymUI": { GymButton: "gym-button" }, "./GymMotion": { GymReveal: "reveal" },
  });
  const plan = { id: "plan", date: "2026-10-03", data: blueprint() };
  const session = { id: "session", planId: "plan", data: logic.newSession(plan.data, plan.date, "Europe/Warsaw", false, true) };
  const props = { session, plan, units: { weight: "kg", distance: "km" }, onOpen() {}, onRemove() {}, onRemovePlan() {} };
  const state = tree => findNode(tree, node => node.type === "article").props["data-workout-status"];
  assert.equal(state(PlanCard({ plan })), "unconfirmed");
  session.data.exercises[0].sets[0].completed = true;
  assert.equal(state(SessionCard(props)), "in-progress");
  session.data.status = "completed";
  const before = JSON.stringify(session);
  const completed = SessionCard(props);
  assert.equal(state(completed), "completed");
  assert.equal(findNode(completed, node => node.type === "gym-button").props.tone, "completed");
  assert.equal(JSON.stringify(session), before);
  session.data.exercises[0].sets[0].completed = false;
  session.data.completionMode = "confirmation";
  assert.equal(state(SessionCard(props)), "completed");
});
