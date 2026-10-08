import { z } from "zod";
import { todoBoardSchema } from "../todo";
import { preferenceSchema } from "../account/preferences";
import { eventWriteSchema } from "./event-contract";
import { gymWriteSchema } from './gym-contract';
import { financeWriteSchema,financeQuerySchema } from './finance-contract';
import { investmentWriteSchema,investmentMarketQuery } from './investment-contract';

import { momentumWriteSchema,momentumQuerySchema } from './momentum-contract';
import { accountCommandSchema } from './account-contract';
import {inboxQuerySchema,inboxDetailQuery,inboxCommandSchema} from './inbox-contract';

export class MobileError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type MobilePrincipal = { id: string; name: string; email: string; emailVerified: boolean; expiresAt: string; sessionId?: string };
export type MobileDependencies = {
  enabled: boolean;
  webOrigin: string;
  authenticate(headers: Headers): Promise<MobilePrincipal | null>;
  bootstrap(owner: string): Promise<{ access: { canWrite: boolean; state: string }; legal: { writable: boolean; reason: string | null }; [key: string]: unknown }>;
  quota(owner: string): Promise<boolean>;
  read(resource: string, owner: string, anchor?: string, query?:Record<string,string>): Promise<unknown>;
  write(resource: "todo" | "preferences" | "events" | "gym" | "finance" | "investments" | "momentum", owner: string, input: unknown): Promise<unknown>;
  authorizeMomentumWrite?(owner: string, input: unknown): Promise<void>;
  authorizeGymWrite?(owner: string, input: unknown): Promise<void>;
  account?(owner:string,input:unknown):Promise<unknown>;
  inbox?(owner:string,input:unknown):Promise<unknown>;
};
const operation = { operationId: z.uuid(), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) };
export const todoWriteSchema = z.object({ ...operation, data: todoBoardSchema }).strict();
export const preferencesWriteSchema = z.object({ ...operation, data: preferenceSchema }).strict();
const resources = ["bootstrap", "todo", "preferences", "calendar", "gym", "gym-library", "events", "finance", "investments", "investment-market", "membership", "membership-refresh", "momentum", "account", "account-export", "inbox", "inbox-detail", "inbox-target", "inbox-settings"];
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });

/** The authenticated owner is never accepted in a path, query or body. */
export function mobileHandler(deps: MobileDependencies) {
  return async (request: Request, resource: string) => {
    try {
      if (!deps.enabled || !resources.includes(resource)) throw new MobileError(404, "unavailable", "Mobile integration is unavailable on this server.");
      if (!["GET", "PUT"].includes(request.method)) throw new MobileError(405, "method", "Unsupported request method.");
      const url = new URL(request.url);
      const keys=[...url.searchParams.keys()];
      if(keys.some(key=>url.searchParams.getAll(key).length>1|| (resource==='inbox'?key!=='cursor':['inbox-detail','inbox-target'].includes(resource)?key!=='id':resource==='momentum'?key!=='week':resource==='investment-market'?key!=='ids':resource==='finance'?!Object.hasOwn(financeQuerySchema.shape,key):!["calendar","events"].includes(resource)||key!=="anchor")))throw new MobileError(400,'invalid','Unsupported query parameters.');
      if(resource==='inbox')inboxQuerySchema.parse(Object.fromEntries(url.searchParams));
      if(['inbox-detail','inbox-target'].includes(resource))inboxDetailQuery.parse(Object.fromEntries(url.searchParams));
      if(resource==='momentum')momentumQuerySchema.parse(Object.fromEntries(url.searchParams));
      if(resource==='finance')financeQuerySchema.parse(Object.fromEntries(url.searchParams));
      if(resource==='investment-market')investmentMarketQuery.parse(Object.fromEntries(url.searchParams));
      // Cookie-authenticated browser writes require the same origin. A native
      // request has no browser Origin and uses the fixed registered app scheme.
      if (request.method === "PUT") {
        const origin = request.headers.get("origin"), nativeOrigin = request.headers.get("expo-origin");
        if (origin ? origin !== deps.webOrigin : nativeOrigin !== "udmobile://") throw new MobileError(403, "origin", "Request origin is not allowed.");
        if (request.headers.get("sec-fetch-site") === "cross-site") throw new MobileError(403, "origin", "Request origin is not allowed.");
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new MobileError(415, "invalid", "Send a JSON request.");
      }
      const principal = await deps.authenticate(request.headers);
      if (!principal || !Number.isFinite(Date.parse(principal.expiresAt)) || Date.parse(principal.expiresAt) <= Date.now()) throw new MobileError(401, "session", "Sign in again. Your session has ended.");
      if (!await deps.quota(principal.id)) throw new MobileError(429, "rate", "Too many requests. Try again shortly.");
      if(resource==='membership-refresh'&&request.method!=='PUT')throw new MobileError(405,'method','Use a membership confirmation request.');
      if (request.method === "GET") {
        if (resource === "bootstrap") return json({ version: 1, user: principal, ...await deps.bootstrap(principal.id) });
        const anchor = ["calendar","events"].includes(resource) ? z.iso.date().parse(url.searchParams.get("anchor")) : undefined;
        return json({ version: 1, data: await deps.read(resource, principal.id, anchor,['finance','investment-market','momentum','inbox','inbox-detail','inbox-target'].includes(resource)?Object.fromEntries(url.searchParams):undefined) });
      }
      if (resource !== "todo" && resource !== "preferences" && resource !== "events" && resource !== "gym" && resource !== "finance" && resource !== "investments" && resource !== "momentum" && resource !== "membership-refresh" && resource !== 'account' && resource!=='inbox') throw new MobileError(405, "method", "This destination is read-only in this checkpoint.");
      // Reading/dismissing owned messages does not change source activity or entitlements.
      if(resource==='inbox'){
        if(!deps.inbox)throw new MobileError(404,'unavailable','The inbox is unavailable.');
        const command=inboxCommandSchema.parse(await boundedBody(request));
        if(command.type==='settings'){
          if(!principal.emailVerified)throw new MobileError(403,'verification','Verify your email before changing reminder preferences.');
          if((await deps.bootstrap(principal.id)).access.state==='deletion-pending')throw new MobileError(403,'deletion','This account is pending deletion.');
        }
        return json({version:1,data:await deps.inbox(principal.id,command)});
      }
      // Rights/security remain available to unverified, expired and deletion-pending owners.
      if(resource==='account'){
        if(!deps.account)throw new MobileError(404,'unavailable','Account controls are unavailable.');
        return json({version:1,data:await deps.account(principal.id,accountCommandSchema.parse(await boundedBody(request)))});
      }
      if (!principal.emailVerified) throw new MobileError(403, "verification", "Verify your email in Account & Settings on the website.");
      const state = await deps.bootstrap(principal.id);
      if (state.access.state === "deletion-pending") throw new MobileError(403, "deletion", "This account is pending deletion.");
      if (resource !== "preferences" && resource !== "membership-refresh") {
        if (!state.legal.writable) throw new MobileError(403, "legal", state.legal.reason ?? "Review your legal acceptance on the website.");
        if (!state.access.canWrite && (resource !== 'gym' || !deps.authorizeGymWrite) && (resource!=='momentum'||!deps.authorizeMomentumWrite)) throw new MobileError(403, "membership", "Membership is read-only. Your saved records remain available.");
      }
      const body=await boundedBody(request);
      if(resource==='membership-refresh'){
        z.object({}).strict().parse(body);
        return json({version:1,data:await deps.read(resource,principal.id)});
      }
      const input = (resource === "todo" ? todoWriteSchema : resource === "events" ? eventWriteSchema : resource === 'gym' ? gymWriteSchema : resource==='finance'?financeWriteSchema:resource==='investments'?investmentWriteSchema:resource==='momentum'?momentumWriteSchema:preferencesWriteSchema).parse(body);
      if(resource==='momentum'&&deps.authorizeMomentumWrite)await deps.authorizeMomentumWrite(principal.id,input);
      if (resource === 'gym' && deps.authorizeGymWrite) await deps.authorizeGymWrite(principal.id,input);
      return json({ version: 1, data: await deps.write(resource, principal.id, input) });
    } catch (error) {
      if (error instanceof MobileError) return json({ error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof z.ZodError) return json({ error: { code: "invalid", message: "Check the entered values and try again." } }, 400);
      if (process.env.MANFORTH_MOBILE_QA_LOCAL === 'true') {
        const candidate=error as {code?:unknown;cause?:{code?:unknown}};
        const code=candidate?.code??candidate?.cause?.code;
        const message=error instanceof Error?error.message:'';
        const missingRelation=/relation "([a-z][a-z0-9_]{0,63})" does not exist/.exec(message)?.[1]??null;
        console.warn('Isolated QA mobile request failed', {resource,sqlState:typeof code==='string'&&/^[A-Z0-9]{5}$/.test(code)?code:null,missingRelation});
      }
      // Do not expose SQL, session tokens, provider responses or internal errors.
      return json({ error: { code: "unavailable", message: "The server could not complete this request. Try again." } }, 503);
    }
  };
}

async function boundedBody(request:Request){
  // Bound streaming bodies as well as advertised Content-Length.
  if (Number(request.headers.get("content-length")) > 512_000) throw new MobileError(413, "invalid", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new MobileError(400, "invalid", "Missing request data.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 512_000) { await reader.cancel(); throw new MobileError(413, "invalid", "The request is too large."); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new MobileError(400, "invalid", "Invalid JSON request."); }
  return body;
}
