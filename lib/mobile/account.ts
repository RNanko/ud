import 'server-only';
import { cookies } from 'next/headers';
import { accountSql } from '../account/store';
import { PERSONAL_PRODUCT } from '../account/config';
import {attemptToken,protectedKey} from '../account/email/crypto';
import { challengeState } from '../account/email/challenges';
import { beginEmailProof,resendEmailProof,confirmEmailCode,completeAccountEmail,changeAccountPassword,accountSessions,revokeAccountSession,revokeOtherAccountSessions } from '../actions/identity.actions';
import { saveAccountName } from '../actions/account.actions';
import { exportAccountData,deletePersonalAccount } from '../actions/privacy.actions';
import { accountCommandSchema } from './account-contract';
import { MobileError } from './http';
import type { ActionResult } from '../account/result';
function unwrap<T>(result:ActionResult<T>):T{if(!result.ok)throw new MobileError(400,'invalid',result.error);return result.value;}
async function deletion(owner:string){const rows=await accountSql`SELECT status,created_at,completed_at FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;return rows[0]??null;}
export async function readMobileAccount(owner:string){return {sessions:unwrap(await accountSessions()),deletion:await deletion(owner)};}
export async function exportMobileAccount(){
 const value=unwrap(await exportAccountData());
 // Keep the existing web export contract. Native sharing omits provider IDs.
 return {...value,membership:value.membership?{...value.membership,sources:value.membership.sources.map(({subscriptionId,...source})=>{void subscriptionId;return source;})}:null};
}
/** Mailbox proof is a short-lived capability sent in a private body, never a URL or disk journal. */
export async function writeMobileAccount(owner:string,input:unknown){
 const command=accountCommandSchema.parse(input),pending=await deletion(owner);
 if(pending&&['name','password','proof-begin','proof-resend','proof-confirm'].includes(command.type))throw new MobileError(403,'deletion','This account is pending deletion. Export, sessions and support remain available.');
 if(command.type==='name')return {message:'Display name saved.',...await saveAccountName({name:command.name})};
 if(command.type==='password')return {message:unwrap(await changeAccountPassword({currentPassword:command.currentPassword,newPassword:command.newPassword},true)).message,signInRequired:true};
 if(command.type==='revoke-session')return unwrap(await revokeAccountSession(command.id));
 if(command.type==='revoke-others')return unwrap(await revokeOtherAccountSessions());
 if(command.type==='delete'){
   const result=await deletePersonalAccount({password:command.password,confirmation:command.confirmation,stopRenewals:command.stopRenewals});
   const status=await deletion(owner);
   // The tombstone is authoritative even if the provider response was lost.
   if(status?.status==='completed')return {deletion:status,message:'Account deletion confirmed.',signInRequired:true};
   if(status)return {deletion:status,message:'Deletion is pending. Your account is read-only while billing or database confirmation is resolved.',signInRequired:false};
   unwrap(result);throw new MobileError(503,'unavailable','Deletion has not been confirmed. Reload account status before retrying.');
 }
 const jar=await cookies();
 if('proof' in command&&command.proof){
   const state=await challengeState(command.proof);
   if(!state||state.owner_id!==owner||!['verify-account','email-change'].includes(state.purpose))throw new MobileError(403,'verification','Request a new code for this account.');
   if(command.type==='proof-begin'&&(state.email!==command.email.toLowerCase()||state.purpose!==command.purpose))throw new MobileError(400,'invalid','Start a new proof for the selected address.');
   if(command.type==='proof-confirm'&&state.consumed_at){
     const [user]=await accountSql`SELECT email,email_verified FROM "user" WHERE id=${owner}`;
     if(user?.email===state.email&&user.email_verified)return {message:'Email verified.',email:state.email};
     throw new MobileError(403,'verification','Reload account status, then request a new code if needed.');
   }
   jar.set('b1-mail-proof',command.proof,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:86400});
 }else jar.delete('b1-mail-proof');
 if(command.type==='proof-begin'){
   const result=unwrap(await beginEmailProof({email:command.email,purpose:command.purpose,...(command.currentPassword?{currentPassword:command.currentPassword}:{})}));
   let token=jar.get('b1-mail-proof')?.value;
   if(token&&!await challengeState(token)){
     // Restart can lose the in-memory capability. After canonical owner/password
     // checks, rotate only the same owner's active proof; reuse its latest code.
     const replacement=attemptToken();
     const rows=await accountSql`UPDATE b1_email_attempts SET token_hash=${protectedKey(replacement)} WHERE id=(SELECT id FROM b1_email_attempts WHERE owner_id=${owner} AND email=${command.email.toLowerCase()} AND purpose=${command.purpose} AND consumed_at IS NULL AND expires_at>now() ORDER BY expires_at DESC LIMIT 1) AND consumed_at IS NULL AND expires_at>now() RETURNING id`;
     if(rows[0])token=replacement;
   }
   return {...result,proof:token};
 }
 if(command.type==='proof-resend')return unwrap(await resendEmailProof());
 if(command.type==='proof-confirm'){
   const state=await challengeState(command.proof);
   unwrap(await confirmEmailCode(command.code));
   const result=unwrap(await completeAccountEmail(state!.purpose as 'verify-account'|'email-change'));
   return {message:'Email verified. Other devices signed out.',...result};
 }
 throw new MobileError(400,'invalid','Unknown account command.');
}
