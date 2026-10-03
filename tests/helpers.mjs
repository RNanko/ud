import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

// Execute the real TS modules with only framework/network boundaries replaced.
export function loadModule(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (["server-only"].includes(name)) return {};
      if (/(?:^|\/)account\/(?:decimal|config|preferences)$/.test(name)) return loadModule(`lib/account/${name.split('/').at(-1)}.ts`, mocks, globals);
      if (name === "./config" && file.replaceAll('\\', '/').includes('lib/account/')) return loadModule('lib/account/config.ts', mocks, globals);
      if (name === "../account/store" || name === "@/lib/account/store") { const p=loadModule('lib/account/preferences.ts');return {accountSettings:async()=>({preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:0})}; }
      if (name === "@/app/components/shared/account/AccountPreferencesProvider") { const p=loadModule('lib/account/preferences.ts');return { useAccountPreferences:()=>({settings:{preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:0},replace(){}}) }; }
      if (["@/hooks/use-account-calendar","./use-account-calendar"].includes(name)) return loadModule('hooks/use-account-calendar.ts', { ...mocks, react: {useMemo:fn=>fn()}, '@/lib/gym/dates':loadModule('lib/gym/dates.ts',{'../finance':loadModule('lib/finance.ts')}) });
      if (name === "@/hooks/use-account-format") return {useAccountFormat:()=>{const f=loadModule("lib/finance.ts");const i=loadModule("lib/investments.ts");return {formatAmount:f.formatAmount,formatFinanceDate:f.formatFinanceDate,investmentMoney:i.investmentMoney,investmentQuantity:i.investmentQuantity};}};
      if (name === "@/lib/actions/calendar-window.actions") return {getAccountEventWindow:async()=>{throw Error("Unexpected Sunday-window request");},saveAccountEventWindow:async()=>{throw Error("Unexpected Sunday-window save");}};
      if (name === "../account/preferences") return loadModule('lib/account/preferences.ts');
      if (name === "@/lib/actions/account.actions") return {saveAccountSettings:async input=>({...(await loadModule('lib/account/preferences.ts')),preferences:input.value,revision:input.revision+1})};
      if (name === "zod" || name === "crypto") return nativeRequire(name);
      throw new Error(`Missing mock for ${name} in ${file}`);
    },
    console, process, Buffer, File, FormData, crypto, Date, Error, URL, Headers, Request, Response, AbortSignal, setTimeout, clearTimeout, URLSearchParams, ...globals,
  }, { filename: file });
  return exports;
}

export function hookHarness() {
  const values = [];
  let index = 0;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = typeof initial === "function" ? initial() : initial;
      return [values[slot], (next) => {
        values[slot] = typeof next === "function" ? next(values[slot]) : next;
      }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    },
    useMemo: (fn) => fn(),
    useEffect() {},
  };
  return { react, render(fn) { index = 0; return fn(); } };
}

export const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};

export function findNode(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
}

export const plain = (value) => JSON.parse(JSON.stringify(value));
