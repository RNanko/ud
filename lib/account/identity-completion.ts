import "server-only";
import { sql } from "drizzle-orm";
import { authDb, runAuthTransaction } from "../db/auth-drizzle";
import { protectedKey } from "./email/crypto";
import { takeQuota } from "./email/policy";
import { PublicError } from "./errors";
import type { ChallengePurpose } from "./email/challenges";

type Proof = {id:string;user_id:string;email:string;old_email:string|null;purpose:ChallengePurpose|"recovery"|"migration"};
type Receipt = {proof_id:string;owner_id:string;email:string;old_email:string|null;purpose:Proof['purpose'];request_key:string;status:string};
const unavailable=()=>new PublicError("This verification cannot complete that request. Retry the original request while it is valid, or request a new verification.");
const proofFrom=(row:Receipt):Proof=>({id:row.proof_id,user_id:row.owner_id,email:row.email,old_email:row.old_email,purpose:row.purpose});

async function finish(kind:'email'|'recovery',id:string,owner:string,purpose:Proof['purpose'],requestKey:string,consume:(proof:Proof)=>Promise<boolean>,mutate:(proof:Proof)=>Promise<unknown>){
 return runAuthTransaction(async()=>{
  const rows=await authDb.execute(sql`SELECT * FROM b1_identity_completions WHERE proof_kind=${kind} AND proof_id=${id} FOR UPDATE`);
  const receipt=rows.rows[0] as Receipt|undefined;
  if(!receipt||receipt.owner_id!==owner||receipt.purpose!==purpose||receipt.request_key!==requestKey)throw unavailable();
  const proof=proofFrom(receipt);
  if(receipt.status==='committed')return proof;
  if(purpose!=='signup'){
   // Distinct proofs still mutate one identity. Hold its row through Better
   // Auth's mailbox lookup so a concurrent change cannot reassign that mailbox.
   const users=await authDb.execute(sql`SELECT email FROM "user" WHERE id=${owner} FOR UPDATE`);
   if(users.rows[0]?.email!==(kind==='email'?proof.old_email:proof.email))throw unavailable();
  }
  if(!await consume(proof))throw unavailable();
  await mutate(proof);
  await authDb.execute(sql`UPDATE b1_identity_completions SET status='committed',committed_at=clock_timestamp() WHERE proof_kind=${kind} AND proof_id=${id}`);
  return proof;
 });
}
async function completionBudget(kind:string,tokenKey:string){
 // Bound retries before comparing a password-derived fingerprint, including
 // committed receipts. A stolen old capability cannot become an unlimited oracle.
 if(!await takeQuota(`identity-completion:${kind}:${tokenKey}`,10,900))throw new PublicError("Too many verification attempts. Wait 15 minutes before trying again.");
}
export async function completeEmailIdentity(token:string,purpose:ChallengePurpose,owner:string|undefined,input:unknown,mutate:(proof:Proof)=>Promise<unknown>,validate?:()=>Promise<void>){
 const tokenKey=protectedKey(token);await completionBudget('email',tokenKey);
 const requestKey=protectedKey(JSON.stringify(['identity-completion-v1',purpose,owner??null,input]));
 const existing=await authDb.execute(sql`SELECT 1 FROM b1_identity_completions c JOIN b1_email_attempts a ON a.id=c.proof_id WHERE c.proof_kind='email' AND a.token_hash=${tokenKey}`);
 // Invalid proposed input must not permanently bind an otherwise valid proof.
 // Committed retries acknowledge the original mutation under its original policy.
 if(!existing.rows[0])await validate?.();
 // The autocommitted reservation survives a rollback and binds future retries.
 await authDb.execute(sql`INSERT INTO b1_identity_completions(proof_kind,proof_id,owner_id,purpose,request_key,email,old_email)
  SELECT 'email',id,CASE WHEN purpose='signup' THEN user_id ELSE owner_id END,purpose,${requestKey},email,old_email
  FROM b1_email_attempts WHERE token_hash=${tokenKey} AND purpose=${purpose} AND verified_at IS NOT NULL
   AND consumed_at IS NULL AND expires_at>clock_timestamp() AND
   ((${purpose}='signup' AND owner_id IS NULL AND ${owner??null}::text IS NULL) OR (purpose<>'signup' AND owner_id=${owner??null}))
  ON CONFLICT(proof_kind,proof_id) DO NOTHING`);
 const found=await authDb.execute(sql`SELECT id,user_id,owner_id FROM b1_email_attempts WHERE token_hash=${tokenKey} AND purpose=${purpose}`);
 const row=found.rows[0] as {id:string;user_id:string;owner_id:string|null}|undefined;
 if(!row|| (purpose==='signup'?owner!==undefined||row.owner_id!==null:row.owner_id!==owner))throw unavailable();
 return finish('email',row.id,purpose==='signup'?row.user_id:owner!,purpose,requestKey,async proof=>{
  const consumed=await authDb.execute(sql`UPDATE b1_email_attempts SET consumed_at=clock_timestamp()
   WHERE id=${row.id} AND token_hash=${tokenKey} AND purpose=${purpose} AND verified_at IS NOT NULL
    AND consumed_at IS NULL AND expires_at>clock_timestamp()
    AND ((${purpose}='signup' AND owner_id IS NULL AND user_id=${proof.user_id}) OR
     (owner_id=${owner??null} AND EXISTS(SELECT 1 FROM "user" u WHERE u.id=${owner??null} AND u.email=${proof.old_email}
      AND (${purpose}='email-change' OR lower(u.email)=lower(${proof.email}))))) RETURNING id`);
  return consumed.rows.length===1;
 },mutate);
}
export async function completeRecoveryIdentity(token:string,password:string,mutate:(proof:Proof)=>Promise<unknown>,validate?:()=>Promise<void>){
 const key=protectedKey(token);await completionBudget('recovery',key);
 const requestKey=protectedKey(JSON.stringify(['identity-completion-v1','recovery',password]));
 const existing=await authDb.execute(sql`SELECT 1 FROM b1_identity_completions WHERE proof_kind='recovery' AND proof_id=${key}`);
 if(!existing.rows[0])await validate?.();
 await authDb.execute(sql`INSERT INTO b1_identity_completions(proof_kind,proof_id,owner_id,purpose,request_key,email)
  SELECT 'recovery',c.token_key,c.user_id,c.purpose,${requestKey},u.email FROM b1_recovery_claims c JOIN "user" u ON u.id=c.user_id
  WHERE c.token_key=${key} AND c.claimed_at IS NULL AND c.expires_at>clock_timestamp() ON CONFLICT(proof_kind,proof_id) DO NOTHING`);
 const found=await authDb.execute(sql`SELECT user_id,purpose FROM b1_recovery_claims WHERE token_key=${key}`);
 const claim=found.rows[0] as {user_id:string;purpose:'recovery'|'migration'}|undefined;
 if(!claim)throw unavailable();
 return finish('recovery',key,claim.user_id,claim.purpose,requestKey,async proof=>{
  const consumed=await authDb.execute(sql`UPDATE b1_recovery_claims SET claimed_at=clock_timestamp()
   WHERE token_key=${key} AND user_id=${proof.user_id} AND purpose=${proof.purpose} AND claimed_at IS NULL AND expires_at>clock_timestamp()
    AND EXISTS(SELECT 1 FROM "user" WHERE id=${proof.user_id} AND email=${proof.email}) RETURNING user_id`);
  return consumed.rows.length===1;
 },mutate);
}
// Read-only mobile acknowledgement: consumed_at alone is never proof of commit.
export async function emailIdentityCompleted(token:string,purpose:Exclude<ChallengePurpose,'signup'>,owner:string){
 const rows=await authDb.execute(sql`SELECT 1 FROM b1_identity_completions c JOIN b1_email_attempts a ON a.id=c.proof_id
  WHERE c.proof_kind='email' AND c.status='committed' AND c.owner_id=${owner} AND c.purpose=${purpose}
   AND a.owner_id=${owner} AND a.purpose=${purpose} AND a.token_hash=${protectedKey(token)}`);
 return rows.rows.length===1;
}
