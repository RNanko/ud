import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode } from './helpers.mjs';

const policy = loadModule('lib/account/private-identity.ts');
const now = Date.parse('2026-10-07T12:00:00Z');
const sessionFor = id => ({ data: { user: { id }, session: { expiresAt: new Date(now + 3600000) } }, isPending: false, isRefetching: false, error: null });

function fixture() {
  let session = sessionFor('alice'), clock = now;
  const hooks = hookHarness();
  const effects = [], timers = new Map();
  let timerId = 0;
  const Boundary = loadModule('app/components/shared/account/PrivateIdentityBoundary.tsx', {
    react: { ...hooks.react, Activity: 'Activity', useEffect: callback => effects.push(callback) }, 'react/jsx-runtime': jsxRuntime,
    './SessionProvider': { useAuthSession: () => session },
    '@/app/components/shared/loader': { __esModule: true, default: 'Loader' },
    '@/lib/account/private-identity': policy,
    '@/lib/account/session-signal': { subscribeSessionChange: () => () => {} },
  }, {
    Date: class extends Date { static now() { return clock; } },
    navigator: { onLine: true }, window: new EventTarget(),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  }).default;
  const draft = { type: 'FinanceEditor', props: { amount: '123.45', comment: 'Unsaved Alice draft' } };
  const render = () => {
    const tree = hooks.render(() => Boundary({ owner: 'alice', children: draft }));
    effects.splice(0).forEach(effect => effect());
    return tree;
  };
  return { render, draft, snapshot: value => { session = value; }, expire: () => { clock += 3600001; timers.forEach(callback => callback()); } };
}

test('checking and transient session failures hide the same private tree without discarding its draft', () => {
  const f = fixture();
  assert.equal(findNode(f.render(), node => node.type === 'Activity').props.mode, 'visible');
  for (const patch of [{ isRefetching: true }, { error: { status: 503 } }, { error: { message: 'offline' } }]) {
    f.snapshot({ ...sessionFor('alice'), ...patch });
    const tree = f.render(), activity = findNode(tree, node => node.type === 'Activity');
    assert.equal(activity.props.mode, 'hidden');
    assert.equal(activity.props.children, f.draft);
    assert.ok(findNode(tree, node => node.props?.role === 'status'));
  }
  f.snapshot(sessionFor('alice'));
  const activity = findNode(f.render(), node => node.type === 'Activity');
  assert.equal(activity.props.mode, 'visible');
  assert.equal(activity.props.children, f.draft);
});

test('confirmed cross-tab logout unmounts private children and a late old-owner result cannot restore them', () => {
  const f = fixture(); f.render();
  f.snapshot({ data: null, isPending: false, isRefetching: false, error: null });
  assert.equal(findNode(f.render(), node => node.type === 'Activity'), undefined);
  f.snapshot(sessionFor('alice'));
  const tree = f.render();
  assert.equal(findNode(tree, node => node.type === 'Activity'), undefined);
  assert.equal(findNode(tree, node => node.type === 'a').props.href, '/auth/login');
});

test('account switching and expiry permanently discard the old tree until a fresh document navigation', () => {
  const switched = fixture(); switched.render(); switched.snapshot(sessionFor('bob'));
  const tree = switched.render();
  assert.equal(findNode(tree, node => node.type === 'Activity'), undefined);
  assert.equal(findNode(tree, node => node.type === 'a').props.href, '/account');
  switched.snapshot(sessionFor('alice'));
  assert.equal(findNode(switched.render(), node => node.type === 'Activity'), undefined);
  const expired = fixture(); expired.render(); expired.expire();
  assert.equal(findNode(expired.render(), node => node.type === 'Activity'), undefined);
  expired.snapshot(sessionFor('alice'));
  assert.equal(findNode(expired.render(), node => node.type === 'Activity'), undefined);
});

test('the session authority distinguishes 401, malformed expiry and temporary errors', () => {
  assert.equal(policy.privateIdentityStatus('alice', { ...sessionFor('alice'), error: { status: 401 } }, now), 'unauthenticated');
  assert.equal(policy.privateIdentityStatus('alice', { ...sessionFor('alice'), data: { user: { id: 'alice' }, session: { expiresAt: 'invalid' } } }, now), 'checking');
  assert.equal(policy.privateIdentityStatus('alice', { ...sessionFor('alice'), error: { status: 503 } }, now), 'checking');
});

test('server guards still deny writes after logout and reject a stale caller owner after account switch', async () => {
  let session = null;
  const guard = loadModule('lib/session.ts', {
    react: { cache: fn => fn },
    'next/headers': { headers: async () => new Headers() },
    './auth': { auth: { api: { getSession: async options => { assert.equal(options.query.disableCookieCache, true); return session; } } } },
  });
  await assert.rejects(guard.requireUserId('alice', 'write'), /Unauthorized/);
  session = { session: { userId: 'bob' } };
  await assert.rejects(guard.requireUserId('alice', 'write'), /Unauthorized/);
});

test('successful sign-in invalidates other tabs through the shared session check; ordinary reads do not broadcast', () => {
  let options, signals = 0;
  loadModule('lib/auth-client.ts', {
    'better-auth/react': { createAuthClient: input => { options = input; return {}; } },
    './account/session-signal': { announceSessionChange: () => { signals++; } },
  }, { window: { location: { origin: 'http://localhost' } } });
  for (const path of ['/get-session', '/unknown']) options.fetchOptions.onSuccess({ request: { url: '/api/auth' + path } });
  assert.equal(signals, 0);
  for (const path of ['/sign-in/email', '/sign-out', '/change-password', '/revoke-session']) options.fetchOptions.onSuccess({ request: { url: '/api/auth' + path } });
  assert.equal(signals, 4);
  assert.equal(options.sessionOptions.refetchInterval, 60);
});

test('cross-tab messages only request revalidation and listeners are removed on unmount', () => {
  const channels = [], window = new EventTarget();
  class Channel {
    constructor(name) { this.name = name; channels.push(this); }
    postMessage(value) { this.message = value; }
    close() { this.closed = true; }
  }
  const signal = loadModule('lib/account/session-signal.ts', {}, { window, BroadcastChannel: Channel });
  let checks = 0;
  const dispose = signal.subscribeSessionChange(() => { checks++; });
  signal.announceSessionChange();
  assert.equal(channels[1].message, 'revalidate');
  assert.equal(channels[1].closed, true);
  channels[0].onmessage({ data: { user: { id: 'forged-owner' } } });
  assert.equal(checks, 1);
  dispose(); assert.equal(channels[0].closed, true);
});

test('blocked browser messaging cannot turn a successful authentication into a failure', () => {
  const signal = loadModule('lib/account/session-signal.ts', {}, {
    window: new EventTarget(), BroadcastChannel: class { constructor() { throw Error('blocked'); } },
    localStorage: { setItem() { throw Error('blocked'); } },
  });
  assert.doesNotThrow(() => signal.announceSessionChange());
  assert.doesNotThrow(() => signal.subscribeSessionChange(() => {})());
});
