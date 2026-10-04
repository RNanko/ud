import 'server-only';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { accountSql } from '../account/store';
import { assertProductWrite } from '../account/access';
import { afterNotificationSourceChange } from '../notifications/store';
import { getGymData } from '../actions/gym.actions';
import { gymExercises } from '../gym/catalogue';
import { strengthPresets, resolveStrength,cardioPresets,resolveCardio } from '../gym/presets';
import { newSession } from '../gym/logic';
import { sessionSchema } from '../gym/validation';
import { prepareSessionSave } from '../gym/session-write';
import { gymWriteSchema } from './gym-contract';
import { MobileError } from './http';
import type { SessionData } from '../gym/types';

type Stored = { id: string; user_id: string; data: SessionData; revision: number; archived: boolean; [key: string]: unknown };
function canonical(value: unknown): unknown { return Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)])) : value; }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const conflict = () => new MobileError(409,'conflict','This workout changed on another device or was removed. Your local entries are retained. Review the saved record before editing again.');
async function stored(kind: string, owner: string, id: string): Promise<Stored | null> {
  // SQL identifiers come only from this fixed server allowlist.
  const table = ({ entity:'gym_entities', plan:'gym_plans', session:'gym_sessions', rest:'gym_rest_days' } as Record<string,string>)[kind];
  if (!table) throw new Error('Unsupported Gym resource');
  const rows = await accountSql.query(`SELECT to_jsonb(t)-'created_at' AS row FROM ${table} t WHERE user_id=$1 AND id=$2`,[owner,id]);
  return rows[0]?.row ?? null;
}
export function mobileGymLibrary() {
  return { exercises: gymExercises, presets: [...strengthPresets.map(preset => ({ id:preset.id, name:preset.name,
    profiles: (['foundation','regular','advanced','expert'] as const).map(profile => ({ profile, data:resolveStrength(preset,profile) })),
  })),...cardioPresets.map(preset=>({id:preset.id,name:preset.name,profiles:preset.variants.map(minutes=>({profile:'foundation' as const,label:`${minutes} minutes`,data:resolveCardio(preset,minutes)}))}))] };
}
/** Limited access can finish an existing eligible active workout, never create one. */
export async function authorizeGymWrite(owner: string, input: unknown) {
  const payload = gymWriteSchema.parse(input), {data} = payload;
  const receipts = await accountSql`SELECT fingerprint FROM b1_mobile_gym_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
  if (receipts.length && receipts[0].fingerprint===hash(payload)) return;
  try { await assertProductWrite(owner,data.kind==='session' ? {kind:'workout',id:data.id} : undefined); }
  catch { throw new MobileError(403,'membership','Your current access does not permit this workout change. Saved records remain available.'); }
}
export async function writeMobileGym(owner: string, input: unknown) {
  const payload = gymWriteSchema.parse(input), command = payload.data, fingerprint = hash(payload);
  const receipts = await accountSql`SELECT fingerprint,result FROM b1_mobile_gym_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
  let result: {kind:string;id:string};
  if (receipts.length) {
    if (receipts[0].fingerprint!==fingerprint) throw conflict();
    result=receipts[0].result;
  } else {
    const kind = command.kind==='template'||command.kind==='exercise' ? 'entity' : command.kind==='start'||command.kind==='reopen' ? 'session' : command.kind==='archive' ? command.resource : command.kind;
    const id = command.kind==='rest' ? `${owner}:${command.date}` : command.id;
    const before=await stored(kind,owner,id);
    const revision='revision' in command ? command.revision : null;
    if (before?.archived || ('revision' in command && (revision===null ? before!==null : !before || before.revision!==revision))) throw conflict();
    let after: Record<string,unknown> = before ? {...before} : {id,user_id:owner};
    let dependency: Stored | null=null;
    if (command.kind==='start') {
      if (before) throw conflict();
      dependency=command.planId ? await stored('plan',owner,command.planId) : null;
      if (command.planId && (!dependency || dependency.archived)) throw conflict();
      const blueprint=dependency?.data ?? command.data;
      if (!blueprint) throw new MobileError(400,'invalid','Choose a plan or exercises before starting.');
      after={...after,plan_id:command.planId,data:sessionSchema.parse(newSession(blueprint as Parameters<typeof newSession>[0],command.date,command.timezone,command.logged,!!command.planId||!command.logged))};
    } else if (command.kind==='session') {
      if (!before) throw conflict();
      try { after.data=prepareSessionSave(before.data,command.data); }
      catch { throw new MobileError(400,'invalid','Check your actual entries. Completed sessions stay completed; use Reopen explicitly.'); }
    } else if (command.kind==='reopen') {
      if (!before || before.data.status!=='completed') throw conflict();
      after.data=sessionSchema.parse({...before.data,status:'active',completionMode:'detailed',finishedAt:null,restUntil:null});
    } else if (command.kind==='archive') {
      if (!before) throw conflict();
      after.archived=true;
    } else if (command.kind==='rest') {
      if (Boolean(before?.rest)!==command.previous) throw conflict();
      after={...after,date:command.date,timezone:command.timezone,rest:command.rest};
    } else {
      if (command.kind==='exercise' && command.data.id!==command.id) throw new MobileError(400,'invalid','The custom exercise identity must match its record.');
      if (before && ['template','exercise'].includes(command.kind) && before.kind!==command.kind) throw conflict();
      after={...after,data:command.data,...(command.kind==='plan'?{date:command.date,timezone:command.timezone}:{kind:command.kind})};
    }
    const outcome=(await accountSql`SELECT b1_mobile_save_gym(${owner},${payload.operationId}::uuid,${fingerprint},${kind},${id},${before===null?null:JSON.stringify(before)}::jsonb,${JSON.stringify(after)}::jsonb,${dependency===null?null:JSON.stringify(dependency)}::jsonb,${command.kind==='start'}) AS result`)[0]?.result;
    if (!outcome || !['saved','duplicate'].includes(outcome.outcome)) throw conflict();
    result={kind:outcome.kind,id:outcome.id};
  }
  // Retryable notification refresh uses existing canonical source identities.
  await afterNotificationSourceChange(owner);
  revalidatePath('/account/gym'); revalidatePath('/account/events');
  return {acknowledgedOperationId:payload.operationId,result,gym:await getGymData()};
}
