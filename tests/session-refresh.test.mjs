import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadModule } from './helpers.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('installed auth refresh manager polls every 15 minutes, ignores tab focus and keeps account-change signals immediate', () => {
  let options;
  loadModule('lib/auth-client.ts', {
    'better-auth/react': { createAuthClient: value => { options = value; return {}; } },
    './account/session-signal': { announceSessionChange() {} },
  });
  let online = true, reads = 0, poll, interval, broadcast, signal;
  const focusListeners = new Set();
  const mocks = {
    './broadcast-channel.mjs': { getGlobalBroadcastChannel: () => ({
      post() {}, setup: () => () => {}, subscribe: fn => { broadcast = fn; return () => {}; },
    }) },
    './focus-manager.mjs': { getGlobalFocusManager: () => ({
      setup: () => () => {}, subscribe: fn => { focusListeners.add(fn); return () => focusListeners.delete(fn); },
    }) },
    './online-manager.mjs': { getGlobalOnlineManager: () => ({
      get isOnline() { return online; }, setup: () => () => {}, subscribe: () => () => {},
    }) },
  };
  // The installed ESM module runs with only browser event managers and its
  // clock replaced, so the configured interval/focus behaviour is exercised.
  const engine = {};
  const code = ts.transpileModule(readFileSync('node_modules/better-auth/dist/client/session-refresh.mjs', 'utf8'), {
    fileName: 'session-refresh.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports: engine, require: name => mocks[name], Date, Math,
    setInterval: (fn, delay) => { poll = fn; interval = delay; return 1; }, clearInterval() {},
  });
  const manager = engine.createSessionRefreshManager({
    options, fetchSession: () => { reads++; }, sessionSignal: { listen: fn => { signal = fn; return () => {}; } },
  });
  manager.init();
  assert.equal(interval, 15 * 60 * 1000);
  for (const listener of focusListeners) listener();
  assert.equal(reads, 0);
  poll(); assert.equal(reads, 1);
  online = false; poll(); assert.equal(reads, 1);
  online = true; broadcast(); signal(); assert.equal(reads, 3);
  manager.cleanup();
});

function surfaces() {
  const window = new EventTarget(), document = new EventTarget(), timers = new Map();
  let timerId = 0;
  Object.defineProperty(document, 'visibilityState', { value: 'visible' });
  const ui = {
    window, document, timers,
    setInterval: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearInterval: id => timers.delete(id),
    async foreground() { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); await flush(); },
  };
  window.setInterval = ui.setInterval;
  window.clearInterval = ui.clearInterval;
  return ui;
}

test('Gym updates for saved workouts and its background timer without fetching on tab return', async () => {
  const ui = surfaces(), effects = [], received = [];
  let reads = 0;
  const hook = loadModule('hooks/use-gym-sync.ts', {
    react: { useEffect: fn => effects.push(fn), useRef: value => ({current:value}) },
    '@/lib/actions/gym.actions': { getGymData: async () => { reads++; return { plans: [] }; } },
  }, ui);
  hook.useGymSync(data => received.push(data), false);
  const dispose = effects[0]();
  await ui.foreground(); assert.equal(reads, 0);
  ui.window.dispatchEvent(new Event('gym-records-changed')); await flush();
  assert.equal(reads, 1); assert.equal(received.length, 1);
  await [...ui.timers.values()][0].fn(); assert.equal(reads, 2);
  dispose(); ui.window.dispatchEvent(new Event('gym-records-changed')); await flush();
  assert.equal(reads, 2); assert.equal(ui.timers.size, 0);
});
