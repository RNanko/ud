import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";

const board = [{ id: "monday", day: "Monday", tasks: [{ id: "event", title: "Read", completed: false }] }];
const preset = name => ({ id: crypto.randomUUID(), name, board });
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture(initial = [], mode = "save") {
  const hooks = hookHarness(), writes = [], deletes = [], applied = [];
  let loaded = false, closed = 0, failSave = false, failDelete = false, pending;
  const component = loadModule("app/(main)/account/events/WeekPresets.tsx", {
    react: { ...hooks.react, useEffect: fn => { if (!loaded) { loaded = true; fn(); } } },
    "react/jsx-runtime": jsxRuntime, "lucide-react": {},
    "../gym/GymUI": { GymDialog: "Dialog", GymButton: "Button", Field: "Field", Confirm: "Confirm" },
    "@/lib/actions/planner.actions": {
      getNamedWeekPresets: async () => initial,
      saveNamedWeekPreset: async command => {
        writes.push(command);
        if (pending) await pending;
        if (failSave) return { success: false, message: "Save unavailable" };
        return { success: true, data: [...command.before, { id: command.id, name: command.name, board: command.board }] };
      },
      removeNamedWeekPreset: async command => {
        deletes.push(command);
        if (failDelete) return { success: false, message: "Remove unavailable" };
        return { success: true, data: command.before.filter(item => item.id !== command.id) };
      },
    },
  }).default;
  const render = () => hooks.render(() => component({ mode, week: "2026-WK41", board, onClose: () => closed++, onApply: value => applied.push(value) }));
  const form = () => findNode(render(), node => node.type === "form").props;
  const button = label => findNode(render(), node => node.props?.["aria-label"] === label).props;
  const setName = value => findNode(render(), node => node.props?.label === "Preset name").props.onChange({ target: { value } });
  render(); await tick();
  return { render, form, button, setName, writes, deletes, applied, closed: () => closed,
    failSave: value => { failSave = value; }, failDelete: value => { failDelete = value; }, pending: value => { pending = value; } };
}

test("one submit saves, updates the visible list and keeps the dialog open; failed retries retain their ID", async () => {
  const state = await fixture();
  state.setName("  Usual week  ");
  state.failSave(true);
  await state.form().onSubmit({ preventDefault() {} });
  assert.equal(state.writes.length, 1);
  const id = state.writes[0].id;
  assert.equal(state.writes[0].name, "Usual week");
  assert.equal(findNode(state.render(), node => node.props?.label === "Preset name").props.value, "  Usual week  ");
  state.failSave(false);
  await state.form().onSubmit({ preventDefault() {} });
  assert.equal(state.writes[1].id, id);
  assert.equal(state.closed(), 0);
  assert.ok(state.button("Remove week preset Usual week"));
  assert.equal(findNode(state.render(), node => node.props?.label === "Preset name").props.value, "");
});

test("a pending save ignores rapid duplicate submits and blocks dismissal", async () => {
  const state = await fixture();
  let finish;
  state.pending(new Promise(resolve => { finish = resolve; }));
  state.setName("Busy week");
  const submit = state.form().onSubmit;
  const first = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  findNode(state.render(), node => node.type === "Dialog").props.onClose();
  assert.equal(state.writes.length, 1);
  assert.equal(state.closed(), 0);
  finish(); await first;
});

test("removal retains saved presets on failure and frees a slot after success", async () => {
  const initial = [preset("First"), preset("Second"), preset("Third")];
  const state = await fixture(initial);
  state.setName("Fourth");
  await state.form().onSubmit({ preventDefault() {} });
  assert.equal(state.writes.length, 0);
  state.button("Remove week preset Second").onClick();
  const confirm = () => findNode(state.render(), node => node.type === "Confirm").props;
  state.failDelete(true);
  await assert.rejects(confirm().onConfirm(), /Remove unavailable/);
  assert.ok(state.button("Remove week preset Second"));
  state.failDelete(false);
  await confirm().onConfirm(); confirm().onClose();
  assert.equal(findNode(state.render(), node => node.props?.["aria-label"] === "Remove week preset Second"), undefined);
  assert.deepEqual(plain(state.deletes[0].before), initial);
  await state.form().onSubmit({ preventDefault() {} });
  assert.equal(state.writes.length, 1);
  assert.deepEqual(plain(state.writes[0].before.map(item => item.name)), ["First", "Third"]);
});

test("saved presets can still be selected for applying and removed from the picker", async () => {
  const saved = preset("Usual week"), state = await fixture([saved], "apply");
  state.button("Use week preset Usual week").onClick();
  assert.deepEqual(plain(state.applied), [board]);
  assert.equal(state.writes.length, 0);
  assert.ok(state.button("Remove week preset Usual week"));
});
