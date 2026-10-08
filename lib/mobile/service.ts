import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "../auth";
import { productAccess } from "../account/access";
import { appOrigin } from "../account/config";
import { mobileWebsiteOrigin } from './web-origin';
import { accountSettings, accountSql } from "../account/store";
import { defaultNotifications } from "../account/preferences";
import { afterNotificationSourceChange } from "../notifications/store";
import { takeQuota } from "../account/email/policy";
import { getAccountEventWindow } from "../actions/calendar-window.actions";
import { getGymData } from "../actions/gym.actions";
import { emptyTodoBoard, todoBoardSchema } from "../todo";
import { MobileError, mobileHandler, preferencesWriteSchema, todoWriteSchema } from "./http";
import { readMobileEvents, writeMobileEvents } from "./events";
import { authorizeGymWrite, mobileGymLibrary, writeMobileGym } from './gym';
import { reconcileMembership } from '../account/billing/reconcile';
import { nativeBillingConfigured, reconcileNativeMembership } from '../account/billing/native';
import { readMobileFinance,writeMobileFinance } from './finance';
import { readMobileInvestments,readMobileInvestmentMarket,writeMobileInvestment } from './investments';

import { authorizeMomentumWrite,readMobileMomentum,writeMobileMomentum } from './momentum';

import { readMobileAccount,exportMobileAccount,writeMobileAccount } from './account';
import {readMobileInbox,readMobileInboxDetail,readMobileInboxTarget,writeMobileInbox} from './inbox';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)])) : value;
}
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

async function bootstrap(owner: string) {
  const [access, settings] = await Promise.all([productAccess(owner), accountSettings(owner)]);
  // Owner-approved static Terms/Privacy pages collect no acceptance history.
  // Keep the v1 response shape for installed clients; verification, ownership,
  // deletion and product membership remain independently enforced.
  return { access, settings, legal: { writable: true, reason: null }, webOrigin: mobileWebsiteOrigin(appOrigin(),process.env.MANFORTH_MOBILE_WEB_ORIGIN,process.env.NODE_ENV==='development') };
}
async function readTodo(owner: string) {
  // One statement gives data + revision from the same database snapshot.
  const rows = await accountSql`SELECT b.data,COALESCE(v.revision,0)::text AS revision FROM "user" u
   LEFT JOIN kanban_board b ON b.user_id=u.id LEFT JOIN b1_mobile_todo_versions v ON v.user_id=u.id WHERE u.id=${owner}`;
  if (rows.length !== 1) throw new MobileError(409, "conflict", "Your task board requires review. Open the website or contact support.");
  const revision = Number(rows[0].revision);
  if (!Number.isSafeInteger(revision)) throw new MobileError(503, "unavailable", "Task revision requires server review.");
  return { board: todoBoardSchema.parse(rows[0].data ?? emptyTodoBoard()), revision };
}
async function write(resource: "todo" | "preferences" | "events" | "gym" | "finance" | "investments" | "momentum", owner: string, input: unknown) {
  if(resource==='momentum')return writeMobileMomentum(owner,input);
  if(resource==='investments')return writeMobileInvestment(owner,input);
  if(resource==='finance')return writeMobileFinance(owner,input);
  if (resource === 'gym') return writeMobileGym(owner,input);
  if (resource === "events") return writeMobileEvents(owner,input);
  const payload = resource === "todo" ? todoWriteSchema.parse(input) : preferencesWriteSchema.parse(input);
  const rows = resource === "todo"
    ? await accountSql`SELECT b1_mobile_save_todo(${owner},${payload.operationId}::uuid,${fingerprint(payload)},${payload.revision},${JSON.stringify(payload.data)}::jsonb) AS outcome`
    : await accountSql`SELECT b1_mobile_save_preferences(${owner},${payload.operationId}::uuid,${fingerprint(payload)},${payload.revision},${JSON.stringify(payload.data)}::jsonb,${JSON.stringify(defaultNotifications)}::jsonb) AS outcome`;
  const outcome = rows[0]?.outcome;
  if (outcome === "unauthorized") throw new MobileError(401, "session", "Sign in again.");
  if (outcome === "conflict" || outcome === "operation-reused") throw new MobileError(409, "conflict", "Changes exist on another device, or this request ID was already used. Your entered changes are still here. Reload before editing again.");
  if (outcome !== "saved" && outcome !== "duplicate") throw new Error("Unacknowledged mobile operation");
  if (resource === "todo") revalidateTag("todo-data", { expire: 0 });
  else { await afterNotificationSourceChange(owner); revalidatePath("/account", "layout"); }
  // A repeated request acknowledges its receipt and returns current data,
  // never a stale cached board that could resurrect an intervening deletion.
  return { acknowledgedOperationId: payload.operationId, ...(resource === "todo" ? await readTodo(owner) : { settings: await accountSettings(owner) }) };
}
export const handleMobileRequest = mobileHandler({
  enabled: process.env.MANFORTH_MOBILE_API_ENABLED === "true",
  webOrigin: appOrigin(),
  async authenticate(headers) {
    // Next can reload edited .env files during development. Recheck the
    // actual runtime connection, rather than trusting a filename or URL alone.
    if (process.env.MANFORTH_MOBILE_QA_LOCAL === 'true') {
      const [identity]=await accountSql`SELECT current_database() AS database,current_user AS role`;
      if(identity?.database!=='qa_tablename'||identity?.role!=='manforth_mobile_qa') throw new MobileError(503,'unavailable','The isolated API database identity changed. Restart the guarded QA launcher.');
    }
    const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    if (!session?.session?.userId || session.user.id !== session.session.userId) return null;
    return { id: session.session.userId, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified, expiresAt: new Date(session.session.expiresAt).toISOString(), sessionId: session.session.id };
  },
  bootstrap,
  quota: owner => takeQuota(`mobile:v1:${owner}`, 180, 60),
  async read(resource, owner, anchor, query) {
    if(resource==='inbox-settings')return accountSettings(owner);
    if(resource==='inbox')return readMobileInbox(owner,query);
    if(resource==='inbox-detail')return readMobileInboxDetail(owner,query);
    if(resource==='inbox-target')return readMobileInboxTarget(owner,query);
    if(resource==='account')return readMobileAccount(owner);
    if(resource==='account-export')return exportMobileAccount();
    if(resource==='momentum')return readMobileMomentum(owner,query);
    if(resource==='investments')return readMobileInvestments(owner);
    if(resource==='investment-market')return readMobileInvestmentMarket(owner,query);
    if(resource==='finance')return readMobileFinance(owner,query);
    if(resource==='membership-refresh'){
      await reconcileMembership(owner);
      await reconcileNativeMembership(owner);
    }
    if(resource==='membership'||resource==='membership-refresh'){
      const access=await productAccess(owner);
      return {access,activeProviders:access.activeProviders,multipleActiveSources:access.multipleActiveSources,nativeConfigured:nativeBillingConfigured()};
    }
    if (resource === "todo") return readTodo(owner);
    if (resource === "preferences") return accountSettings(owner);
    // Reuse canonical guarded reads, including account week-start handling.
    // These functions independently check the same request session owner.
    if (resource === "calendar" && anchor) return getAccountEventWindow(anchor);
    if (resource === "events" && anchor) return readMobileEvents(owner,anchor);
    if (resource === "gym") return getGymData();
    if (resource === 'gym-library') return mobileGymLibrary();
    throw new MobileError(404, "unavailable", "Unknown destination.");
  },
  write,
  account:writeMobileAccount,
  inbox:writeMobileInbox,
  authorizeGymWrite,
  authorizeMomentumWrite,
});
