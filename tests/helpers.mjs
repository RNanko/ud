import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
let publicErrors;
const backgroundModules = new WeakMap();

// Execute the real TS modules with only framework/network boundaries replaced.
export function loadModule(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    fileName: file,
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
      if (['../events/recurrence','@/lib/events/recurrence'].includes(name)) {
        const dates=loadModule('lib/gym/dates.ts',{'../finance':loadModule('lib/finance.ts')}), timing=loadModule('lib/planner-time.ts');
        const validation=loadModule('lib/gym/validation.ts',{'./types':loadModule('lib/gym/types.ts'),'./dates':dates,'../planner-time':timing});
        const events=loadModule('lib/events.ts',{'./gym/dates':dates,'./gym/validation':validation,'./planner-time':timing});
        return loadModule('lib/events/recurrence.ts',{'../events':events,'../gym/validation':validation,'../planner-time':timing,'./calendar-rule':loadModule('lib/events/calendar-rule.ts',{'../gym/validation':validation})});
      }
      // Legacy fixtures have no schedule records; the recurrence/store suite uses real PostgreSQL.
      if (['../events/schedule-store','../../events/schedule-store'].includes(name)) return {schedulesReady:async()=>false,readEventSchedules:async()=>[],readScheduledOccurrences:async()=>[],withScheduledEvents:async(_owner,board)=>board};
      if (name==='@/lib/events/schedule-signal') return loadModule('lib/events/schedule-signal.ts',mocks,globals);
      if (name==='@/lib/events/activity-feed') return loadModule('lib/events/activity-feed.ts', {'../events':mocks['@/lib/events'] ?? loadModule('lib/events.ts',mocks,globals),'../calendar':loadModule('lib/calendar.ts')},globals);
      if (name==='@/lib/events/request-timeout') return loadModule('lib/events/request-timeout.ts',mocks,globals);
      if (name==='@/lib/actions/activity.actions') return {setPlannerActivityCompletion:async()=>{throw Error('Missing activity completion test boundary');}};
      if (name==='@/lib/actions/event-schedules.actions') return {getEventSchedules:async()=>[],saveScheduledEvent:async()=>{throw Error('Unexpected recurring event write');}};
      if (name==='./EventSchedulesDialog') return {__esModule:true,default:'EventSchedulesDialog'};
      // Legacy suites model accounts before the additive v2 migration. V2 SQL
      // tests exercise the actual guard, archive and receipt functions.
      if (name === "./finance-motion.module.css") return {};
      if (["server-only"].includes(name)) return {};
      if (name === "next/server") return { after: () => { throw Error("Missing post-response test boundary"); } };
      if (name === "./use-background-save") return loadModule('hooks/use-background-save.ts', mocks, globals);
      if (name === "@/lib/background-save-queue") {
        if (!backgroundModules.has(globals)) backgroundModules.set(globals, loadModule('lib/background-save-queue.ts', mocks, globals));
        return backgroundModules.get(globals);
      }
      if (name === "@/hooks/use-finance-background-save") return loadModule('hooks/use-finance-background-save.ts', mocks, globals);
      if (name === "@/hooks/use-planner-moves") return loadModule('hooks/use-planner-moves.ts', mocks, globals);
      if (name === "@/hooks/use-workout-moves") return loadModule('hooks/use-workout-moves.ts', mocks, globals);
      if (name === "./use-gym-sync") return mocks['@/hooks/use-gym-sync'] ?? loadModule('hooks/use-gym-sync.ts', mocks, globals);
      if (name === "@/app/components/shared/BackgroundSaveStatus") return { __esModule: true, default: 'BackgroundSaveStatus' };
      if (name === "@/hooks/use-money-mutation") return loadModule('hooks/use-money-mutation.ts', mocks, globals);
      if (name === "@/app/components/shared/MoneyRecovery") return { __esModule: true, default: 'MoneyRecovery' };
      if (name === "../money/action-result") return loadModule('lib/money/action-result.ts', mocks, globals);
      if (name === "../money/snapshots") return loadModule('lib/money/snapshots.ts', mocks, globals);
      // Legacy-reader fixtures do not exercise money writes. The action/SQL suite
      // injects the real receipt services and PostgreSQL boundary explicitly.
      if (name === "../mobile/finance") return {writeMobileFinance: async () => { throw Error('Unexpected finance writer'); }};
      if (name === "../mobile/investments") return {writeMobileInvestment: async () => { throw Error('Unexpected investment writer'); }};
      // Unrelated action fixtures may load these boundaries, but must explicitly
      // inject them before exercising identity writes or password verification.
      if (name === '../account/password-attempts') return {takePasswordAttempt:async()=>{throw Error('Missing password quota test boundary');}};
      if (name === '../account/identity-completion') return {completeEmailIdentity:async()=>{throw Error('Missing identity completion test boundary');},completeRecoveryIdentity:async()=>{throw Error('Missing recovery completion test boundary');},emailIdentityCompleted:async()=>false};
      if (name === '../db/auth-drizzle') return {currentAuthTransaction:()=>undefined};
      if (name === 'drizzle-orm') return nativeRequire(name);
      if (/(?:^|\/)gym\/event-links$/.test(name)) return loadModule('lib/gym/event-links.ts', mocks, globals);
      if (["./WorkoutDetailsSheet", "./WorkoutLinkedEvents", "../gym/WorkoutLinkedEvents"].includes(name)) return { __esModule: true, default: name.split('/').at(-1) };
      if (/(?:^|\/)finance-currencies$/.test(name)) return loadModule('lib/finance-currencies.ts', mocks, globals);
      if (/(?:^|\/)finance-category-icons$/.test(name)) return loadModule('lib/finance-category-icons.ts', {'./finance-category-icons.json':nativeRequire('../lib/finance-category-icons.json')}, globals);
      if (['./FinanceCategoryIcon','./FinanceCategoryIconPicker'].includes(name)) return {__esModule:true,default:name.slice(2)};
      if (/(?:^|\/)stock-catalog$/.test(name)) return loadModule('lib/stock-catalog.ts', mocks, globals);
      if (["@/lib/account/email/send-status", "../account/email/send-status", "./send-status"].includes(name)) return loadModule('lib/account/email/send-status.ts', mocks, globals);
      // Existing action fixtures run with the additive billing feature disabled.
      // Cross-platform tests inject the real repository and entitlement explicitly.
      if (/(?:^|\/)billing\/sources$/.test(name)||name==='./sources') return {billingSources:async()=>[],billingSourcesEnabled:()=>false,billingEnvironment:()=> 'production',saveBillingSource:async()=>{}};
      if (/(?:^|\/)billing\/entitlement$/.test(name)||name==='./entitlement') return loadModule('lib/account/billing/entitlement.ts',mocks,globals);
      if (/(?:^|\/)billing\/native$/.test(name)) return {nativeBillingConfigured:()=>false,reconcileNativeMembership:async()=>{},processNativeQueue:async()=>0};
      if (name === '../gym/session-write') return loadModule('lib/gym/session-write.ts', { './validation': mocks['../gym/validation'] }, globals);
      if (name === './gym-contract') return loadModule('lib/mobile/gym-contract.ts', { '../gym/validation': mocks['../gym/validation'] ?? loadModule('lib/gym/validation.ts', { './types': loadModule('lib/gym/types.ts'), './dates': loadModule('lib/gym/dates.ts', { '../finance': loadModule('lib/finance.ts') }), '../planner-time': loadModule('lib/planner-time.ts') }) }, globals);
      if(name==='./qa-adapter')return {qaMailEnabled:()=>false,verifyQaMail:async()=>{}};
      if(['./qa-configuration','./email/qa-configuration'].includes(name))return loadModule('lib/account/email/qa-configuration.ts',mocks,globals);
      if(name==='./account-contract')return loadModule('lib/mobile/account-contract.ts',mocks,globals);
      if(name==='./inbox-contract')return loadModule('lib/mobile/inbox-contract.ts',{'../notifications/types':loadModule('lib/notifications/types.ts',mocks,globals)});
      if(name==='./inbox')return {readMobileInbox:async()=>({}),readMobileInboxDetail:async()=>({}),readMobileInboxTarget:async()=>({}),writeMobileInbox:async()=>({})};
      if(name==='../account/record-removal')return loadModule('lib/account/record-removal.ts',mocks,globals);
      if(name==='./finance-contract'||name==='../mobile/finance-contract')return loadModule('lib/mobile/finance-contract.ts',mocks,globals);
      if(name==='./investment-contract'||name==='../mobile/investment-contract')return loadModule('lib/mobile/investment-contract.ts',mocks,globals);
      if(name==='../investments')return loadModule('lib/investments.ts',mocks,globals);
      if(name==='../finance-playground')return loadModule('lib/finance-playground.ts',mocks,globals);
      if (name === "@/lib/account/customer-messages" || name === "./customer-messages" && file.replaceAll('\\', '/').endsWith('lib/account/errors.ts')) return loadModule('lib/account/customer-messages.ts', mocks, globals);
      if (name === "./operator" && file.replaceAll('\\', '/').startsWith('lib/legal/')) return loadModule('lib/legal/operator.ts', mocks, globals);
      if (/(?:^|\/)account\/errors$/.test(name) || ["./errors", "../errors"].includes(name)) return publicErrors ??= loadModule('lib/account/errors.ts');
      // Domain action tests isolate their durable post-commit inbox boundary.
      // Inbox tests supply the real service explicitly instead.
      if (name === "../notifications/store") return {afterNotificationSourceChange:async()=>{}};
      if (/(?:^|\/)brand$/.test(name)) return loadModule('lib/brand.ts', mocks, globals);
      if (name === "@/app/components/shared/TaskBody") return loadModule('app/components/shared/TaskBody.tsx', mocks, globals);
      if (name === "@/app/components/shared/account/BirthDateField") return {__esModule:true,default:'BirthDate'};
      if (["@/app/components/shared/account/MembershipAccessSummary", "./MembershipAccessSummary"].includes(name)) return {__esModule:true,default:'MembershipAccessSummary'};
      if (["../calendar","@/lib/calendar"].includes(name)) return loadModule('lib/calendar.ts', mocks, globals);
      if (["./gym/dates", "../gym/dates"].includes(name)) return loadModule('lib/gym/dates.ts', { ...mocks, '../finance': loadModule('lib/finance.ts', mocks, globals) }, globals);
      if (/(?:^|\/)account\/(?:decimal|config|preferences|format|password-policy|birth-date)$/.test(name)) return loadModule(`lib/account/${name.split('/').at(-1)}.ts`, mocks, globals);
      if(name==='./preferences'&&file.replaceAll('\\','/').startsWith('lib/account/'))return loadModule('lib/account/preferences.ts',mocks,globals);
      if (name === './password-policy' && file.replaceAll('\\', '/').startsWith('lib/account/')) return loadModule('lib/account/password-policy.ts', mocks, globals);
      if (["./config", "../config"].includes(name) && file.replaceAll('\\', '/').includes('lib/account/')) return loadModule('lib/account/config.ts', mocks, globals);
      if (name === "../account/store" || name === "@/lib/account/store") { const p=loadModule('lib/account/preferences.ts');return {accountSettings:async()=>({preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:0})}; }
      if (name === "@/app/components/shared/account/AccountPreferencesProvider") { const p=loadModule('lib/account/preferences.ts');return { useAccountPreferences:()=>({settings:{preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:0},replace(){}}) }; }
      if (["@/hooks/use-account-calendar","./use-account-calendar"].includes(name)) return loadModule('hooks/use-account-calendar.ts', { ...mocks, react: {useMemo:fn=>fn()}, '@/lib/gym/dates':loadModule('lib/gym/dates.ts',{'../finance':loadModule('lib/finance.ts')}) });
      if (name === "@/hooks/use-account-format") return {useAccountFormat:()=>{const f=loadModule("lib/finance.ts");const i=loadModule("lib/investments.ts");return {formatAmount:f.formatAmount,formatFinanceDate:f.formatFinanceDate,investmentMoney:i.investmentMoney,investmentQuantity:i.investmentQuantity};}};
      if (name === "@/lib/actions/calendar-window.actions") return {getAccountEventWindow:async()=>{throw Error("Unexpected Sunday-window request");},saveAccountEventWindow:async()=>{throw Error("Unexpected Sunday-window save");}};
      if (name === "../account/preferences") return loadModule('lib/account/preferences.ts');
      if (name === "@/lib/actions/account.actions") return {saveAccountSettings:async input=>({...(await loadModule('lib/account/preferences.ts')),preferences:input.value,revision:input.revision+1})};
      if (name === "zod" || name === "crypto") return nativeRequire(name);
      if (name === "../account/result") return loadModule('lib/account/result.ts', mocks, globals);
      if (["./operator", "../legal/operator"].includes(name)) return loadModule('lib/legal/operator.ts', mocks, globals);
      if (name === "@/lib/account/customer-messages") return loadModule('lib/account/customer-messages.ts', mocks, globals);
      throw new Error(`Missing mock for ${name} in ${file}`);
    },
    console, process, Buffer, File, FormData, crypto, Date, Error, Event, URL, Headers, Request, Response, AbortSignal, setTimeout, clearTimeout, URLSearchParams, structuredClone, ...globals,
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
