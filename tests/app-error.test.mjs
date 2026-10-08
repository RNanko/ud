import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode } from './helpers.mjs';

const screenFile = 'app/components/shared/errors/AppErrorScreen.tsx';
const screenImport = '@/app/components/shared/errors/AppErrorScreen';
const relativeScreenImport = './components/shared/errors/AppErrorScreen';
const screenMock = { __esModule: true, default: 'RecoveryScreen' };
const icons = new Proxy({}, { get: (_target, name) => String(name) });
const styles = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) };

// Styles do not affect these behavioral checks. Unexpected dependencies still
// fail rather than allowing a fallback to rely on a crashed app provider.
function moduleMocks(values) {
  return new Proxy(values, {
    getOwnPropertyDescriptor(target, name) {
      if (Object.hasOwn(target, name)) return Object.getOwnPropertyDescriptor(target, name);
      if (typeof name === 'string' && name.endsWith('.css')) return { configurable: true, value: styles };
    },
    get(target, name) {
      if (Object.hasOwn(target, name)) return target[name];
      if (typeof name === 'string' && name.endsWith('.css')) return styles;
    },
  });
}

function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return textContent(node.props?.children);
}

function fixture() {
  const hooks = hookHarness(), effects = [], scheduled = [];
  let effectIndex, pending = false, retryCount = 0, reloadCount = 0;
  const window = new EventTarget(), navigator = { onLine: true }, logs = [];
  window.location = { reload: () => { reloadCount++; } };
  const Screen = loadModule(screenFile, moduleMocks({
    'react/jsx-runtime': jsxRuntime,
    react: {
      ...hooks.react,
      useTransition: () => [pending, callback => callback()],
      useEffect(callback, deps) {
        const slot = effectIndex++, previous = effects[slot];
        if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps?.[i]))) {
          scheduled.push(() => {
            previous?.cleanup?.();
            effects[slot] = { deps, cleanup: callback() };
          });
        }
      },
    },
    'lucide-react': icons,
    '@/app/components/shared/Brand': { __esModule: true, default: 'Brand' },
  }), { window, navigator, console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args), log: (...args) => logs.push(args) } }).default;
  const onRetry = () => { retryCount++; };
  function render(props = {}, beforeEffects) {
    effectIndex = 0;
    const tree = hooks.render(() => Screen({ onRetry, ...props }));
    beforeEffects?.(tree);
    scheduled.splice(0).forEach(run => run());
    return tree;
  }
  return {
    render,
    retries: () => retryCount,
    reloads: () => reloadCount,
    pending: value => { pending = value; },
    connection: online => { navigator.onLine = online; window.dispatchEvent(new Event(online ? 'online' : 'offline')); },
    close: () => effects.forEach(effect => effect.cleanup?.()),
    logs,
    window,
  };
}

test('unexpected private error messages and stacks never become recovery-page content', () => {
  const f = fixture();
  const error = new Error('Database password=PRIVATE_FIXTURE; user email PRIVATE_FIXTURE');
  error.stack = 'Provider request with bearer PRIVATE_FIXTURE';
  error.digest = '1823347248';
  const tree = f.render({ error });
  assert.doesNotMatch(textContent(tree), /PRIVATE_FIXTURE|Database password|Provider request/);
  assert.doesNotMatch(f.logs.flat().map(value => `${String(value)} ${value?.stack ?? ''}`).join(' '), /PRIVATE_FIXTURE/);
  assert.match(textContent(tree), /1823347248/);
  assert.ok(findNode(tree, node => node.type === 'h1'));
  assert.ok(findNode(tree, node => node.type === 'button' && typeof node.props?.onClick === 'function'));
  f.close();
});

test('arbitrary throwables and malformed support references render safely without exposing their values', () => {
  const f = fixture();
  for (const error of [undefined, null, 17, 'PRIVATE_FIXTURE', ['PRIVATE_FIXTURE'], { message: 'PRIVATE_FIXTURE', stack: 'PRIVATE_FIXTURE' }]) {
    let tree;
    assert.doesNotThrow(() => { tree = f.render({ error }); });
    assert.doesNotMatch(textContent(tree), /PRIVATE_FIXTURE/);
    assert.ok(findNode(tree, node => node.type === 'button'));
  }
  for (const digest of [null, 123, {}, '<script>PRIVATE_FIXTURE</script>', 'PRIVATE_FIXTURE with spaces', 'PRIVATE_FIXTURE' + 'x'.repeat(1000), 'sk_live_PRIVATE_FIXTURE', 'incident_42-OK', '4294967296', '99999999999', '-1', '1.5']) {
    const tree = f.render({ error: { digest } });
    assert.doesNotMatch(textContent(tree), /PRIVATE_FIXTURE|x{1000}|\[object Object\]/);
    if (typeof digest === 'string') assert.equal(textContent(tree).includes(digest), false);
    if (typeof digest === 'number') assert.doesNotMatch(textContent(tree), /123/);
  }
  f.close();
});

test('safe support references can be shared while recovery keeps a plain navigation path home', () => {
  const f = fixture();
  const tree = f.render({ error: { digest: '1823347248' }, fullPage: true });
  assert.match(textContent(tree), /1823347248/);
  const home = findNode(tree, node => node.type === 'a' && node.props?.href === '/');
  assert.ok(home);
  assert.ok(home.props['aria-label'] || textContent(home));
  assert.ok(findNode(tree, node => node.type === 'a' && node.props?.href === '/help'));
  for (const digest of ['0', '4294967295']) assert.equal(textContent(f.render({ error: { digest } })).includes(digest), true);
  f.close();
});

test('standalone recovery has a main landmark while compact recovery fits the existing app landmark', () => {
  const f = fixture();
  const fullPage = f.render({ fullPage: true });
  const main = findNode(fullPage, node => node.type === 'main');
  assert.ok(main);
  assert.equal(findNode(main, node => node.type === 'h1'), findNode(fullPage, node => node.type === 'h1'));
  assert.ok(findNode(main, node => node.type === 'nav' && node.props?.['aria-label'] === 'Page recovery'));
  for (const props of [{}, { fullPage: false }]) {
    const compact = f.render(props);
    assert.equal(findNode(compact, node => node.type === 'main'), undefined);
    assert.ok(findNode(compact, node => node.type === 'h1'));
    assert.ok(findNode(compact, node => node.type === 'button'));
  }
  f.close();
});

test('reading an error reference does not execute untrusted getters or crash on opaque objects', () => {
  const f = fixture();
  let reads = 0;
  const accessor = Object.defineProperty({}, 'digest', { get: () => { reads++; throw Error('PRIVATE_FIXTURE'); } });
  const opaque = new Proxy({}, { getOwnPropertyDescriptor: () => { throw Error('PRIVATE_FIXTURE'); } });
  for (const error of [accessor, opaque]) {
    let tree;
    assert.doesNotThrow(() => { tree = f.render({ error }); });
    assert.doesNotMatch(textContent(tree), /PRIVATE_FIXTURE/);
  }
  assert.equal(reads, 0);
  f.close();
});

test('retry uses the supplied recovery handler and pending work has an accessible disabled control', () => {
  const f = fixture();
  const retry = tree => findNode(tree, node => node.type === 'button' && typeof node.props?.onClick === 'function');
  const button = retry(f.render());
  assert.equal(button.props.type, 'button');
  button.props.onClick();
  assert.equal(f.retries(), 1);
  f.pending(true);
  const pendingTree = f.render();
  assert.equal(retry(pendingTree).props.disabled, true);
  assert.ok(findNode(pendingTree, node => node.props?.role === 'status' || node.props?.['aria-live'] === 'polite'));
  retry(pendingTree).props.onClick();
  assert.equal(f.retries(), 1);
  f.pending(false);
  const ready = retry(f.render());
  assert.notEqual(ready.props.disabled, true);
  ready.props.onClick();
  assert.equal(f.retries(), 2);
  f.close();
});

test('a failed recovery handler leaves a useful fresh-start action without exposing its exception', () => {
  const f = fixture();
  const props = { onRetry: () => { throw new Error('PRIVATE_FIXTURE'); } };
  const before = f.render(props);
  assert.doesNotThrow(() => findNode(before, node => node.type === 'button').props.onClick());
  const after = f.render(props);
  assert.match(textContent(after), /reload|fresh start/i);
  assert.doesNotMatch(textContent(after), /PRIVATE_FIXTURE/);
  assert.notEqual(findNode(after, node => node.type === 'button').props.disabled, true);
  f.close();
});

test('reload remains available during a pending retry and starts a fresh document load', () => {
  const f = fixture();
  f.pending(true);
  const tree = f.render();
  const reload = findNode(tree, node => node.type === 'button' && /reload/i.test(textContent(node)));
  assert.ok(reload);
  assert.notEqual(reload.props.disabled, true);
  reload.props.onClick();
  assert.equal(f.reloads(), 1);
  assert.equal(f.retries(), 0);
  f.close();
});

test('fallback announces the connection change and removes its browser listeners on unmount', () => {
  const f = fixture();
  const online = textContent(f.render());
  f.connection(false);
  const offline = textContent(f.render());
  assert.notEqual(offline, online);
  assert.match(offline, /offline|connection|connect/i);
  f.connection(true);
  assert.equal(textContent(f.render()), online);
  f.close();
  f.connection(false);
  assert.equal(textContent(f.render()), online);
  f.close();

  const initiallyOffline = fixture();
  initiallyOffline.connection(false);
  initiallyOffline.render();
  assert.match(textContent(initiallyOffline.render()), /offline/i);
  initiallyOffline.close();
});

test('a mounted recovery screen puts keyboard focus on its accessible heading', () => {
  const f = fixture();
  let focused = 0;
  const tree = f.render({}, rendered => {
    const heading = findNode(rendered, node => node.type === 'h1');
    assert.ok(heading);
    assert.equal(heading.props.tabIndex, -1);
    heading.props.ref.current = { focus: () => { focused++; } };
  });
  assert.equal(focused, 1);
  assert.ok(textContent(findNode(tree, node => node.type === 'h1')));
  f.close();
});

test('route and layout fallbacks use Next retry and keep document wrappers outside the account shell', () => {
  const boundaries = [
    ['app/error.tsx', true],
    ['app/(main)/error.tsx', false],
    ['app/(main)/account/error.tsx', false],
    ['app/(auth)/auth/error.tsx', false],
    ['app/(main)/account/gym/error.tsx', false],
    ['app/(main)/account/momentum/error.tsx', false],
  ];
  for (const [file, fullPage] of boundaries) {
    const Boundary = loadModule(file, {
      'react/jsx-runtime': jsxRuntime,
      [screenImport]: screenMock,
      [relativeScreenImport]: screenMock,
    }).default;
    let retries = 0, resets = 0;
    const error = new Error('PRIVATE_FIXTURE');
    const tree = Boundary({ error, retry: () => { retries++; }, reset: () => { resets++; } });
    const screen = findNode(tree, node => node.type === 'RecoveryScreen');
    assert.ok(screen, file);
    assert.equal(screen.props.error, error, file);
    assert.equal(screen.props.fullPage ?? false, fullPage, file);
    screen.props.onRetry();
    assert.equal(retries, 1, file);
    assert.equal(resets, 0, file);
    assert.equal(findNode(tree, node => node.type === 'html' || node.type === 'body'), undefined, file);
  }
});

test('the global fallback renders its own accessible document without requiring app providers', () => {
  const GlobalError = loadModule('app/global-error.tsx', moduleMocks({
    'react/jsx-runtime': jsxRuntime,
    react: { useEffect() {} },
    [relativeScreenImport]: screenMock,
  })).default;
  let retries = 0;
  const tree = GlobalError({ error: new Error('PRIVATE_FIXTURE'), retry: () => { retries++; } });
  assert.equal(tree.type, 'html');
  assert.equal(tree.props.lang, 'en');
  assert.ok(findNode(tree, node => node.type === 'body'));
  assert.ok(textContent(findNode(tree, node => node.type === 'title')));
  const screen = findNode(tree, node => node.type === 'RecoveryScreen');
  assert.ok(screen);
  assert.equal(screen.props.fullPage, true);
  screen.props.onRetry();
  assert.equal(retries, 1);
});

test('the global document honors an explicit theme and survives unavailable browser storage', () => {
  for (const [preference, expected] of [['light', 'light'], ['dark', 'dark'], [null, 'dark'], ['blocked-storage', 'dark']]) {
    const effects = [], listeners = new Map(), document = { documentElement: { dataset: {} } };
    const media = { matches: true, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
    const GlobalError = loadModule('app/global-error.tsx', moduleMocks({
      'react/jsx-runtime': jsxRuntime,
      react: { useEffect: callback => effects.push(callback) },
      [relativeScreenImport]: screenMock,
    }), {
      document,
      window: { matchMedia: query => { assert.equal(query, '(prefers-color-scheme: dark)'); return media; } },
      localStorage: { getItem: key => { assert.equal(key, 'theme'); if (preference === 'blocked-storage') throw Error('Storage blocked'); return preference; } },
    }).default;
    GlobalError({ error: null, retry() {} });
    const cleanup = effects[0]();
    assert.equal(document.documentElement.dataset.appErrorTheme, expected);
    media.matches = false;
    listeners.get('change')();
    assert.equal(document.documentElement.dataset.appErrorTheme, preference === 'dark' ? 'dark' : 'light');
    cleanup();
    assert.equal(listeners.size, 0);
    assert.equal(document.documentElement.dataset.appErrorTheme, undefined);
  }
});
