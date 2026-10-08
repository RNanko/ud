import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode } from './helpers.mjs';

const sessionPolicy = loadModule('lib/account/public-session.ts');
const sessionFor = id => ({ data: { user: { id }, session: { expiresAt: '2099-01-01T00:00:00Z' } }, isPending: false, isRefetching: false, error: null });
const guest = { data: null, isPending: false, isRefetching: false, error: null };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const offer = loadModule('lib/landing/offer.ts');
const sessionButton = { __esModule: true, default: 'SessionButton' };

// Run effects when dependencies change, including cleanup of the old request.
function effectsHarness() {
  const hooks = hookHarness(), effects = [], pending = [];
  let index;
  return {
    react: { ...hooks.react, useEffect(fn, deps) {
      const slot = index++, old = effects[slot];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) pending.push(() => {
        old?.cleanup?.(); effects[slot] = { deps, cleanup: fn() };
      });
    } },
    render(fn) { index = 0; const tree = hooks.render(fn); pending.splice(0).forEach(fn => fn()); return tree; },
    close() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

test('unfinished and failed session checks never become anonymous controls', () => {
  for (const snapshot of [{ ...guest, isPending: true }, { ...guest, isRefetching: true }]) assert.equal(sessionPolicy.publicSessionStatus(snapshot), 'loading');
  for (const snapshot of [{ ...guest, error: { status: 503 } }, { ...sessionFor('alice'), error: { status: 503 } }]) assert.equal(sessionPolicy.publicSessionStatus(snapshot), 'error');
  assert.equal(sessionPolicy.publicSessionStatus(guest), 'guest');
  assert.equal(sessionPolicy.publicSessionStatus(sessionFor('alice')), 'authenticated');
  assert.equal(sessionPolicy.publicSessionStatus({ ...sessionFor('alice'), isRefetching: true }), 'authenticated');
  assert.equal(sessionPolicy.publicSessionStatus({ ...sessionFor('alice'), error: { status: 401 } }), 'guest');
  assert.equal(sessionPolicy.publicSessionStatus(sessionFor('alice'), Date.parse('2100-01-01')), 'guest');
});

test('landing app entry waits for identity, then opens immediately without waiting for membership', async () => {
  let session = { ...guest, status: 'loading' };
  const harness = effectsHarness(), requests = [];
  let state;
  const landing = loadModule('app/components/landing/LandingProvider.tsx', {
    react: { ...harness.react, createContext: () => 'Context', useContext: () => state }, 'react/jsx-runtime': jsxRuntime,
    'next/link': { __esModule: true, default: 'Link' }, 'lucide-react': {}, '@/app/components/ui/button': { Button: 'Button' }, '@/lib/landing/offer': offer,
    '@/app/components/shared/account/SessionProvider': { useAuthSession: () => session }, '@/app/components/shared/account/SessionButton': sessionButton,
  }, { AbortController, fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })) });
  const render = () => { state = harness.render(() => landing.default({ trialDays: 14, children: null })).props.value; return landing.MainAction({}); };
  assert.equal(render().type, 'SessionButton');
  assert.deepEqual(requests.map(r => r.url), ['/api/public/offer']);
  session = { ...sessionFor('alice'), status: 'authenticated' };
  let tree = render();
  assert.equal(tree.props.children.props.href, offer.actionDestinations.open);
  assert.equal(tree.props.children.props['aria-label'], 'Open app');
  assert.equal(requests.length, 2);
  requests[1].resolve({ ok: false }); await tick();
  assert.equal(render().props.children.props['aria-label'], 'Open app');
  session = { ...guest, status: 'error' };
  assert.equal(render().props.status, 'error');
  session = { ...guest, status: 'guest' };
  tree = render(); assert.equal(tree.props.children.props.href, offer.actionDestinations.signup);
  harness.close();
});

test('an old account response cannot overwrite a new owner’s landing currency', async () => {
  let session = { ...sessionFor('alice'), status: 'authenticated' };
  const harness = effectsHarness(), requests = [];
  const Provider = loadModule('app/components/landing/LandingProvider.tsx', {
    react: { ...harness.react, createContext: () => 'Context' }, 'react/jsx-runtime': jsxRuntime, 'next/link': {}, 'lucide-react': {}, '@/app/components/ui/button': {}, '@/lib/landing/offer': offer,
    '@/app/components/shared/account/SessionProvider': { useAuthSession: () => session }, '@/app/components/shared/account/SessionButton': sessionButton,
  }, { AbortController, fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })) }).default;
  const render = () => harness.render(() => Provider({ trialDays: 14, children: null })).props.value;
  render(); requests[0].resolve({ ok: true, json: async () => ({ currency: 'PLN' }) }); await tick();
  session = { ...sessionFor('bob'), status: 'authenticated' };
  assert.equal(render().paid, false);
  assert.equal(requests[1].options.signal.aborted, true);
  requests[1].resolve({ ok: true, json: async () => ({ paidCurrency: 'USD' }) }); await tick();
  assert.equal(render().currency, 'PLN');
  requests[2].resolve({ ok: true, json: async () => ({ paidCurrency: 'GBP' }) }); await tick();
  assert.equal(render().currency, 'GBP');
  session = { ...guest, status: 'guest' };
  assert.equal(render().currency, 'PLN'); assert.equal(render().paid, false);
  harness.close();
});

test('auth forms stay hidden until guest confirmation, retain their code step on revalidation, and redirect signed-in users', () => {
  let status = 'loading';
  const harness = effectsHarness(), redirects = [], draft = { type: 'CodeStep', props: { code: '123456' } };
  const Boundary = loadModule('app/components/shared/account/SignedOutBoundary.tsx', {
    react: { ...harness.react, Activity: 'Activity' }, 'react/jsx-runtime': jsxRuntime,
    'next/navigation': { useRouter: () => router }, './SessionProvider': { useAuthSession: () => ({ status, refetch: async () => {} }) }, './SessionButton': sessionButton,
  }).default;
  const router = { replace: path => redirects.push(path) };
  const render = () => harness.render(() => Boundary({ children: draft }));
  assert.equal(findNode(render(), n => n.type === 'Activity').props.mode, 'hidden');
  for (const next of ['guest', 'loading', 'error', 'guest']) {
    status = next;
    const tree = render(), activity = findNode(tree, n => n.type === 'Activity');
    assert.equal(activity.props.mode, next === 'guest' ? 'visible' : 'hidden');
    assert.equal(activity.props.children, draft);
    assert.equal(redirects.length, 0);
  }
  status = 'authenticated';
  assert.equal(findNode(render(), n => n.type === 'Activity').props.mode, 'hidden');
  render(); assert.deepEqual(redirects, ['/account']);
});

test('loading buttons show a spinner, disable clicks, and give session failures a retry', () => {
  const Button = loadModule('app/components/shared/account/SessionButton.tsx', {
    'react/jsx-runtime': jsxRuntime, 'lucide-react': { LoaderCircle: 'Spinner' }, '@/app/components/ui/button': { Button: 'Button' },
  }).default;
  const loading = Button({});
  assert.equal(loading.props.disabled, true); assert.equal(loading.props['aria-busy'], true);
  assert.equal(loading.props.children.type, 'Spinner');
  let retried = false;
  const failed = Button({ status: 'error', onRetry: () => { retried = true; } });
  assert.equal(failed.props.disabled, false); failed.props.onClick(); assert.equal(retried, true);
});

test('session provider keeps public content visible and owns one cross-tab invalidation subscription', async () => {
  let session = { ...guest, isPending: true }, subscribe = 0, unsubscribed = 0, refreshed = 0, signal;
  const refetch = async () => { refreshed++; };
  const harness = effectsHarness();
  const Provider = loadModule('app/components/shared/account/SessionProvider.tsx', {
    react: { ...harness.react, createContext: () => 'Context' }, 'react/jsx-runtime': jsxRuntime,
    '@/lib/auth-client': { authClient: { useSession: () => ({ ...session, refetch }) } },
    '@/lib/account/public-session': sessionPolicy,
    '@/lib/account/session-signal': { subscribeSessionChange: fn => { subscribe++; signal = fn; return () => { unsubscribed++; }; } },
  }).default;
  const publicPage = { type: 'Terms' };
  const render = () => harness.render(() => Provider({ children: publicPage }));
  assert.equal(render().props.children, publicPage);
  session = sessionFor('alice'); render(); render();
  assert.equal(subscribe, 1); signal(); await tick(); assert.equal(refreshed, 1);
  harness.close(); assert.equal(unsubscribed, 1);
});

test('server session lookups share one render but never reuse another request’s owner or skip write authorization', async () => {
  let request = {}, session = { session: { userId: 'alice' } }, reads = 0, writes = 0, headersReady = false;
  const caches = new WeakMap();
  const guard = loadModule('lib/session.ts', {
    react: { cache: fn => (...args) => { if (!caches.has(request)) caches.set(request, fn(...args)); return caches.get(request); } },
    'next/headers': { headers: async () => { headersReady = true; return new Headers(); } },
    './auth': { auth: { api: { get getSession() {
      assert.equal(headersReady, true, 'Request context is read before initializing the auth API');
      return async options => { reads++; assert.equal(options.query.disableCookieCache, true); return session; };
    } } } },
    './account/access': { assertProductWrite: async () => { writes++; } },
  });
  assert.deepEqual(await Promise.all([guard.requireUserId(), guard.requireUserId('alice')]), ['alice', 'alice']);
  assert.equal(reads, 1);
  await guard.requireUserId('alice', 'write'); await guard.requireUserId('alice', 'write'); assert.equal(writes, 2);
  request = {}; headersReady = false; session = { session: { userId: 'bob' } };
  await assert.rejects(guard.requireUserId('alice', 'write'), /Unauthorized/);
  assert.equal(await guard.requireUserId(), 'bob'); assert.equal(reads, 2); assert.equal(writes, 2);
  request = {}; headersReady = false; session = null;
  await assert.rejects(guard.requireUserId(), /Unauthorized/); assert.equal(reads, 3);
});

test('Events starts independent owned reads concurrently after session verification', async () => {
  const calls = [], resolvers = [];
  const read = name => (...args) => { calls.push({ name, args }); return new Promise(resolve => resolvers.push(resolve)); };
  const Page = loadModule('app/(main)/account/events/page.tsx', {
    'react/jsx-runtime': jsxRuntime, react: { Suspense: 'Suspense' }, './EventsClient': 'EventsClient',
    '@/app/components/shared/loader': 'Loader', '@/lib/session': { requireUserId: async () => 'alice' },
    '@/lib/actions/events.actions': { getEventsList: read('events'), getListOfWeeks: read('weeks') },
    '@/lib/actions/gym.actions': { getGymData: read('gym') }, '@/lib/actions/planner.actions': { getEventPresets: read('presets') },
    '@/lib/utils': { getCurrentWeekYear: () => ({ year: 2026, currentWeek: 41 }) }, '@/lib/events': { weekKey: () => '2026-WK42' },
    '@/lib/gym/validation': { calendarDay: { safeParse: () => ({ success: false }) } },
  }).default;
  const child = Page({ searchParams: Promise.resolve({}) }).props.children;
  const pending = child.type(child.props); await tick();
  assert.deepEqual(calls.map(c => c.name), ['events', 'events', 'weeks', 'gym', 'presets']);
  assert.deepEqual(calls[0].args, ['alice', '2026-WK41']);
  for (const [i, resolve] of resolvers.entries()) resolve(i === 2 ? { data: ['2026-WK41'] } : {});
  assert.equal((await pending).type, 'EventsClient');
});
