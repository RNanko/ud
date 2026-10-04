"use server";
import { PublicError } from "../account/errors";
import { brand } from "../brand";
import { cookies, headers } from "next/headers";
import { auth } from "../auth";
import { createEmailVerificationToken } from "better-auth/api";
import z from "zod";
import { actionResult } from "../account/result";
import { accountSql } from "../account/store";
import { appOrigin } from "../account/config";
import { withIdentity } from "../account/identity-context";
import { createChallenge, challengeState, resendChallenge, verifyChallenge, consumeChallenge, type ChallengePurpose } from "../account/email/challenges";
import { assertEmailRequestOrigin, emailAddress, requestBudget } from "../account/email/policy";
import { processMailQueue, enqueueMail, resendClient } from "../account/email/delivery";
import { mailTemplate } from "../account/email/templates";
import { protectedKey } from "../account/email/crypto";
import { validateNewPassword } from "../account/password";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "../account/password-policy";
import {dateOfBirthSchema} from "../account/birth-date";
import { requireUserId } from "../session";
import { legalAgreementSchema, validateAgreement } from "../legal/validation";
import { publishedBundle } from "../legal/store";
import { signupFinalized } from "../account/signup";
import { signupEmailLimitMessage, signupEmailSendLimited } from "../account/email/send-status";
const cookieName="b1-mail-proof";
async function proofToken(){const token=(await cookies()).get(cookieName)?.value;if(!token)throw new PublicError("Request an email code first");return token;}
async function currentUser(){const session=await auth.api.getSession({headers:await headers(),query:{disableCookieCache:true}});if(!session)throw new PublicError("Sign in again");return session.user;}
async function reauthenticate(password:string){const user=await currentUser();await auth.api.signInEmail({headers:await headers(),body:{email:user.email,password}});return user;}
async function securityNotice(id:string,email:string,subject:string,text:string){try{await enqueueMail(id,'security',mailTemplate(email,subject,[text]));await tryDelivery();return true;}catch{return false;}}
async function tryDelivery(){try{await processMailQueue(3);}catch{/* Durable pending state remains; the protected worker retries. */}}
export async function beginEmailProof(input:unknown){return actionResult(async()=>{
 const data=z.object({email:emailAddress,purpose:z.enum(["signup","email-change","verify-account"]),currentPassword:z.string().optional(),legal:legalAgreementSchema.optional()}).strict().parse(input);
 if(data.purpose==="signup")validateAgreement(data.legal,await publishedBundle());
 const h=await headers();assertEmailRequestOrigin(h);
 let owner:Awaited<ReturnType<typeof currentUser>>|undefined;
 if(data.purpose!=="signup"){owner=data.purpose==="email-change"?await reauthenticate(data.currentPassword??""):await currentUser();if(data.purpose==="verify-account"&&data.email!==owner.email.toLowerCase())throw new PublicError("Verify your current login email");if(data.purpose==="email-change"&&data.email===owner.email.toLowerCase())throw new PublicError("Choose a different email");}
 const existing=(await cookies()).get(cookieName)?.value;
 const previous=existing?await challengeState(existing):null;
 if(previous&&!previous.consumed_at&&previous.email===data.email&&previous.purpose===data.purpose&&previous.owner_id===(owner?.id??null)&&Date.parse(previous.expires_at)>Date.now()){
  const sendLimited=data.purpose==="signup"&&signupEmailSendLimited(previous);
  return {message:sendLimited?signupEmailLimitMessage:"Use the latest code already requested for this address.",seconds:Number(previous.wait_seconds),verified:!!previous.verified_at,sendLimited,codeAvailable:true};
 }
 const result=await createChallenge(data.email,data.purpose,h,owner);
 (await cookies()).set(cookieName,result.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:86400});
 await tryDelivery();return {message:result.message,seconds:result.seconds,verified:false,sendLimited:"sendLimited"in result&&result.sendLimited===true,codeAvailable:!("codeAvailable"in result)||result.codeAvailable!==false};
});}
export async function resendEmailProof(){return actionResult(async()=>{const result=await resendChallenge(await proofToken());await tryDelivery();return result;});}
export async function confirmEmailCode(code:string){return actionResult(async()=>{await verifyChallenge(await proofToken(),code);return {verified:true};});}
export async function completeSignup(input:unknown){return actionResult(async()=>{
 const data=z.object({name:z.string().trim().min(1).max(80).optional(),password:z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),dateOfBirth:dateOfBirthSchema,legal:legalAgreementSchema}).strict().parse(input);
 const token=await proofToken(),state=await challengeState(token);
 if(!state||state.purpose!=="signup")throw new PublicError("Verify your email before creating an account");
 validateAgreement(data.legal,await publishedBundle());
 if(state.consumed_at){if(!await signupFinalized(state.user_id))throw new PublicError("Registration is being finalized. Retry shortly or use sign in/recovery.");await auth.api.signInEmail({headers:await headers(),body:{email:state.email,password:data.password}});(await cookies()).delete(cookieName);return {redirect:"/account"};}
 await validateNewPassword(data.password);
 // CAS consumes proof once. The auth adapter transaction creates identity + credential atomically.
 const proof=await consumeChallenge(token,"signup");
 try{await withIdentity({purpose:"signup",email:proof.email,userId:proof.user_id,passwordValidated:true,dateOfBirth:data.dateOfBirth,legal:data.legal},async()=>auth.api.signUpEmail({headers:await headers(),body:{name:data.name??proof.email.split("@")[0].slice(0,80),email:proof.email,password:data.password}}));}
 catch{if(!await signupFinalized(proof.user_id)){await accountSql`UPDATE b1_email_attempts SET consumed_at=NULL WHERE id=${proof.id} AND NOT EXISTS(SELECT 1 FROM "user" WHERE id=${proof.user_id})`;throw new PublicError("Registration could not be completed. Review current documents and retry while your email proof is valid, or use sign in/recovery.");}}
 await auth.api.signInEmail({headers:await headers(),body:{email:proof.email,password:data.password}});
 (await cookies()).delete(cookieName);return {redirect:"/account"};
});}
export async function completeAccountEmail(purpose:Exclude<ChallengePurpose,"signup">){return actionResult(async()=>{
 const owner=await currentUser(),proof=await consumeChallenge(await proofToken(),purpose,owner.id);
 if(proof.old_email!==owner.email)throw new PublicError("Your login email changed. Verify again.");
 const secret=process.env.BETTER_AUTH_SECRET;if(!secret)throw new PublicError("Authentication secret is not configured");
 const token=await createEmailVerificationToken(secret,owner.email,purpose==="email-change"?proof.email:undefined,600,purpose==="email-change"?{requestType:"change-email-verification"}:undefined);
 await withIdentity({purpose,email:proof.email,userId:owner.id},async()=>auth.api.verifyEmail({headers:await headers(),query:{token}}));
 await auth.api.revokeOtherSessions({headers:await headers()});
 if(purpose==="email-change")await securityNotice(`email-change/${proof.id}`,owner.email,`Your ${brand.productName} email changed`,`Your login email has been changed after verification. If this was not you, contact ${brand.supportEmail} immediately.`);
 (await cookies()).delete(cookieName);await tryDelivery();return {email:proof.email};
});}
export async function requestRecovery(input:unknown){return actionResult(async()=>{
 const data=z.object({email:emailAddress,migration:z.boolean().default(false)}).strict().parse(input),h=await headers();
 assertEmailRequestOrigin(h);resendClient();
 const generic={message:"If this address belongs to an eligible account, a recovery link will arrive shortly. You can also sign in, change email, or contact support."};
 if(!await requestBudget(data.email,"recovery",h))return generic;
 const owners=await accountSql`SELECT u.id, EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL) AS credential FROM "user" u WHERE lower(u.email)=${data.email}`;
 // The same user ID gains a credential; no duplicate account is created.
 if(!owners[0]||data.migration&&owners[0].credential)return generic;
 await withIdentity({purpose:data.migration||!owners[0].credential?"migration":"recovery",email:data.email,userId:owners[0].id},async()=>auth.api.requestPasswordReset({headers:h,body:{email:data.email,redirectTo:`${appOrigin()}/auth/reset-password`}}));
 await tryDelivery();return generic;
});}
export async function finishRecovery(input:unknown){return actionResult(async()=>{
 const {token,password}=z.object({token:z.string().min(16).max(512),password:z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)}).strict().parse(input);
 const claims=await accountSql`SELECT user_id,purpose FROM b1_recovery_claims WHERE token_key=${protectedKey(token)} AND claimed_at IS NULL AND expires_at>now()`;
 if(!claims[0])throw new PublicError("Recovery link expired or was already used. Request another link.");
 const users=await accountSql`SELECT email FROM "user" WHERE id=${claims[0].user_id}`;
 if(!users[0])throw new PublicError("Account no longer exists");
 await validateNewPassword(password);
 const claimed=await accountSql`UPDATE b1_recovery_claims SET claimed_at=now() WHERE token_key=${protectedKey(token)} AND claimed_at IS NULL AND expires_at>now() RETURNING user_id,purpose`;
 if(!claimed[0])throw new PublicError("Recovery link was already used. Request another link.");
 await withIdentity({purpose:claimed[0].purpose,email:users[0].email,userId:claimed[0].user_id,passwordValidated:true},async()=>auth.api.resetPassword({headers:await headers(),body:{token,newPassword:password}}));
 const secret=process.env.BETTER_AUTH_SECRET;if(!secret)throw new PublicError("Authentication is not configured");
 // Possession of the library's mailbox-delivered reset token also proves this existing mailbox.
 const verification=await createEmailVerificationToken(secret,users[0].email,undefined,600);
 await withIdentity({purpose:"verify-account",email:users[0].email,userId:claimed[0].user_id},async()=>auth.api.verifyEmail({query:{token:verification},headers:await headers()}));
 const notice=await securityNotice(`password-reset/${protectedKey(token)}`,users[0].email,`Your ${brand.productName} password changed`,"Your password has been changed and other sessions signed out. If this was not you, use recovery or contact support immediately.");
 await tryDelivery();return {message:`Password saved. Sign in with your email and new password.${notice?"":" Security notice delivery is unavailable; contact support if needed."}`};
});}
export async function changeAccountPassword(input:unknown,signOutAfter=false){return actionResult(async()=>{
 const data=z.object({currentPassword:z.string().min(1).max(PASSWORD_MAX_LENGTH),newPassword:z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)}).strict().parse(input),owner=await currentUser();
 const changed=await auth.api.changePassword({headers:await headers(),body:{...data,revokeOtherSessions:true}});
 if(signOutAfter&&changed.token){const context=await auth.$context;await context.internalAdapter.deleteSession(changed.token);}
 const notice=await securityNotice(`password-change/${crypto.randomUUID()}`,owner.email,`Your ${brand.productName} password changed`,"Your password changed and other sessions were signed out. If this was not you, use recovery or contact support immediately.");
 await tryDelivery();return {message:`Password changed. Other devices signed out.${notice?"":" Security notice delivery is unavailable; contact support if needed."}`};
});}
export async function accountSessions(){return actionResult(async()=>{
 const owner=await requireUserId(),session=await auth.api.getSession({headers:await headers(),query:{disableCookieCache:true}});
 const rows=await accountSql`SELECT id,user_agent,ip_address,created_at,updated_at,expires_at FROM session WHERE user_id=${owner} AND expires_at>now() ORDER BY updated_at DESC LIMIT 50`;
 return rows.map(row=>({id:row.id,device:row.user_agent??"Unknown device",ip:row.ip_address??"Unavailable",createdAt:row.created_at,lastSeen:row.updated_at,current:row.id===session?.session.id}));
});}
export async function revokeAccountSession(id:string){return actionResult(async()=>{
 const owner=await requireUserId(),rows=await accountSql`SELECT token FROM session WHERE id=${z.string().max(100).parse(id)} AND user_id=${owner}`;
 if(rows[0])await auth.api.revokeSession({headers:await headers(),body:{token:rows[0].token}});return {message:"Session signed out"};
});}
export async function revokeOtherAccountSessions(){return actionResult(async()=>{await requireUserId();await auth.api.revokeOtherSessions({headers:await headers()});return {message:"Other devices signed out"};});}
