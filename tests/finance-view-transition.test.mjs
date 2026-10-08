import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime } from "./helpers.mjs";

function fixture(reducedMotion = false) {
  const hooks = hookHarness();
  const observers = [];
  let effect, lastView, cleanup;
  hooks.react.useLayoutEffect = setup => { effect = setup; };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    resize(height) { this.callback([{ contentRect: { height } }]); }
  }
  const transition = loadModule("app/(main)/account/finance/FinanceViewTransition.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime,
    "framer-motion": { motion: { div: "Motion" }, useReducedMotion: () => reducedMotion },
    "lucide-react": { LoaderCircle: "Spinner" },
  }, { ResizeObserver: Observer });
  function render(view) {
    const tree = hooks.render(() => transition.default({ view, children: view }));
    tree.props.children.props.ref.current = {};
    if (lastView !== view) { cleanup?.(); cleanup = effect(); lastView = view; }
    return tree;
  }
  return { render, observers, loader: transition.FinanceViewLoader };
}

test("Finance views preserve the previous height while loading, resize smoothly and ignore stale observers", () => {
  const state = fixture();
  assert.equal(state.render("add").props.animate.height, "auto");
  state.observers[0].resize(540);
  assert.equal(state.render("add").props.animate.height, 540);
  assert.equal(state.render("dashboard").props.style["--finance-view-height"], "540px");
  assert.equal(state.observers[0].disconnected, true);
  state.observers[0].resize(999); // An old callback must not overwrite the new panel.
  state.observers[1].resize(0); // A hidden/empty intermediate panel must not collapse the page.
  assert.equal(state.render("dashboard").props.animate.height, 540);
  state.observers[1].resize(810);
  assert.equal(state.render("dashboard").props.animate.height, 810);
  state.render("board");
  state.observers[2].resize(360);
  assert.equal(state.render("board").props.animate.height, 360);
  assert.ok(state.render("board").props.transition.duration > 0);
  assert.equal(state.loader({ label: "Money board" }).props["aria-busy"], "true");
});

test("Finance view transitions respect reduced motion", () => {
  const tree = fixture(true).render("add");
  assert.equal(tree.props.transition.duration, 0);
  assert.equal(tree.props.children.props.initial, false);
  assert.equal(tree.props.children.props.transition.duration, 0);
});
