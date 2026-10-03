import test from "node:test";
import assert from "node:assert/strict";
import { hookHarness, jsxRuntime, loadModule, findNode, plain } from "./helpers.mjs";
import { blueprint, dates, library, logic, validation } from "./gym-fixture.mjs";

const today = dates.dateInZone(new Date(), "Europe/Warsaw");
const makeSession = ids => logic.newSession(blueprint(ids), today, "Europe/Warsaw", false, true);

test("finishing confirms valid actual entries across tracking types without copying targets or inventing distance", () => {
  const data = makeSession(["bench-press", "push-up", "assisted-pull-up", "plank", "stationary-cycling"]);
  data.exercises[0].sets[0] = { ...data.exercises[0].sets[0], loadKg: 60, reps: 10 };
  data.exercises[0].sets[1] = { ...data.exercises[0].sets[1], loadKg: 55, reps: 9 };
  data.exercises[1].sets[0].reps = 12;
  Object.assign(data.exercises[2].sets[0], { loadKg: 0, reps: 8 });
  data.exercises[3].sets[0].seconds = 45;
  data.exercises[4].cardio.seconds = 1500;
  const before = JSON.stringify(data), result = logic.confirmSessionEntries(data);
  assert.equal(result.exercises[0].sets[0].completed, true);
  assert.equal(result.exercises[0].sets[1].completed, true);
  assert.equal(result.exercises[0].sets[2].completed, false);
  assert.equal(result.exercises[1].sets[0].loadKg, null);
  assert.equal(result.exercises[2].sets[0].completed, true);
  assert.equal(result.exercises[3].sets[0].completed, true);
  assert.equal(result.exercises[4].cardio.completed, true);
  assert.equal(result.exercises[4].cardio.distanceKm, null);
  assert.equal(logic.sessionSummary(result).sets, 4);
  assert.equal(logic.sessionSummary(result).exercises, 5);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(plain(result.originalPlan), plain(data.originalPlan));
  assert.deepEqual(plain(logic.confirmSessionEntries(result)), plain(result));
});

test("blank, incomplete and invalid results stay unlogged, while explicitly skipped work keeps earlier records", () => {
  const data = makeSession(["bench-press", "stationary-cycling"]);
  for (const patch of [{ loadKg: 60 }, { reps: 10 }, { loadKg: -1, reps: 10 }, { loadKg: 60, reps: 0 }, { loadKg: 60, reps: 1.5 }]) {
    Object.assign(data.exercises[0].sets[0], { loadKg: null, reps: null }, patch);
    assert.equal(logic.confirmSessionEntries(data).exercises[0].sets[0].completed, false);
  }
  data.exercises[1].cardio.distanceKm = 8.4;
  assert.equal(logic.confirmSessionEntries(data).exercises[1].cardio.completed, false);
  Object.assign(data.exercises[0].sets[0], { loadKg: 60, reps: 10, completed: true });
  Object.assign(data.exercises[0].sets[1], { loadKg: 55, reps: 9, completed: false });
  data.exercises[0].skipped = true;
  const result = logic.confirmSessionEntries(data);
  assert.equal(result.exercises[0].sets[0].completed, true);
  assert.equal(result.exercises[0].sets[1].completed, false);
});

test("Finish workout confirms entries and persists completed status with one workout confirmation", async () => {
  for (const withResults of [true, false]) {
  const hooks = hookHarness();
  let data = makeSession(["bench-press", "stationary-cycling"]), saves = 0;
  if (withResults) {
    Object.assign(data.exercises[0].sets[0], { loadKg: 60, reps: 10 });
    Object.assign(data.exercises[1].cardio, { seconds: 1200, distanceKm: 8.4 });
  }
  const original = plain(data.originalPlan);
  const component = loadModule("app/(main)/account/gym/SessionEditor.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "lucide-react": {},
    "./GymMotion": {}, "@/hooks/use-gym-session": { useGymSession: () => ({ data, state: "saved", update: next => { data = typeof next === "function" ? next(data) : next; }, flush: async () => { assert.equal(validation.sessionSchema.safeParse(data).success, true); saves++; } }) },
    "@/lib/gym/logic": logic, "@/lib/gym/validation": validation,
    "@/lib/actions/gym.actions": {}, "@/lib/gym/dates": dates,
    "./GymUI": { GymButton: "gym-button", Confirm: "confirm-dialog" },
    "./ExerciseLogFields": { actualLabel: () => "", plannedLabel: () => "" },
    "./ExerciseIcon": {}, "./ExercisePicker": {},
  }).default;
  const render = () => hooks.render(() => component({ session: { id: crypto.randomUUID(), revision: 0, planId: null, data }, history: [], exercises: library, units: { weight: "kg", distance: "km" }, today, onCustom() {}, onSaved() {}, onReload() {}, onReopened() {}, onClose() {} }));
  findNode(render(), node => node.type === "gym-button" && node.props.children?.includes?.("Finish workout")).props.onClick();
  const confirmation = findNode(render(), node => node.type === "confirm-dialog").props;
  assert.equal(data.status, "active"); assert.equal(saves, 0);
  assert.ok(confirmation.description.includes(withResults ? "2 recorded exercises" : "without detailed results"));
  await confirmation.onConfirm();
  assert.equal(data.status, "completed"); assert.equal(data.completionMode, withResults ? "detailed" : "confirmation");
  assert.equal(saves, 1); assert.equal(logic.sessionSummary(data).sets, withResults ? 1 : 0);
  assert.equal(data.exercises[1].cardio.completed, withResults);
  assert.equal(data.exercises[0].sets[1].completed, false);
  assert.deepEqual(plain(data.originalPlan), original);
  }
});

test("set logging needs no completion checkbox and records only valid entered values", () => {
  const component = loadModule("app/(main)/account/gym/ExerciseLogFields.tsx", {
    "react/jsx-runtime": jsxRuntime, "lucide-react": {}, "@/lib/gym/logic": logic,
    "./GymUI": { NumberField: "number-field" }, "./GymMotion": {},
  }).default;
  const exercise = makeSession(["bench-press"]).exercises[0];
  exercise.sets[0].loadKg = 60;
  let updated;
  const tree = component({ exercise, units: { weight: "kg", distance: "km" }, disabled: false, onChange: next => { updated = next; }, onRemoveSet() {} });
  assert.equal(findNode(tree, node => node.type === "input" && node.props.type === "checkbox"), undefined);
  findNode(tree, node => node.type === "number-field" && node.props.label === "Repetitions").props.onChange(10);
  assert.equal(updated.sets[0].completed, true);
  assert.equal(updated.sets[1].completed, false);
});
