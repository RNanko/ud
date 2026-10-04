"use server";
import { PublicError } from "../account/errors";
import { headers } from "next/headers";
import z from "zod";
import { auth } from "../auth";
import { requireUserId } from "../session";
import { actionResult } from "../account/result";
import { accountSql, accountSettings, membershipFor } from "../account/store";
import { PERSONAL_PRODUCT } from "../account/config";
import { processDeletion } from "../account/privacy";
import { legalAccountHistory } from "../legal/store";
import { billingSources } from '../account/billing/sources';
import { sourceEntitlement } from '../account/billing/entitlement';
import { billingEnvironment } from '../account/billing/sources';
import { reconcileNativeMembership } from '../account/billing/native';
export async function exportAccountData(){return actionResult(async()=>{
 const owner=await requireUserId(),users=await accountSql`SELECT id,name,email,date_of_birth,email_verified,created_at FROM "user" WHERE id=${owner}`;
 const tables=["finance_table","finance_categories","investment_positions","gym_entities","gym_plans","gym_sessions","gym_rest_days","kanban_board","user_events","user_notes","momentum_state"];
 const results=await Promise.all(tables.map(table=>accountSql.query(`SELECT * FROM "${table}" WHERE user_id=$1`,[owner])));
 const membership=await membershipFor(owner),settings=await accountSettings(owner),legal=await legalAccountHistory(owner);
 const notifications=await accountSql`SELECT id,category,title,body,target,created_at,occurred_at,available_at,published_at,expires_at,invalidated_at,suppressed,read_at,archived_at,revision FROM b1_notifications WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} ORDER BY created_at,id`;
 const ownedSources=await billingSources(owner);
 const billing=membership||ownedSources.length?{product:PERSONAL_PRODUCT,trialStartedAt:membership?.trial_started_at??null,trialEndsAt:membership?.trial_ends_at??null,paidThrough:membership?.paid_through??null,billingCurrency:membership?.billing_currency??null,renewalOff:membership?.renewal_off??null,status:membership?.status??null,sources:ownedSources}:null;
 const likes=await accountSql`SELECT q.id,q.author,q.quote FROM quote_likes l JOIN quotes q ON q.id=l.quote_id WHERE l.user_id=${owner}`;
 return {schemaVersion:3,exportedAt:new Date().toISOString(),product:PERSONAL_PRODUCT,account:users[0],settings,membership:billing,legal,data:{...Object.fromEntries(tables.map((table,index)=>[table,results[index]])),notifications,likedQuotes:likes},measurementPolicy:"Gym loads and distances are stored as kg/km with the recorded load basis. Missing values remain null. Unrecorded finance currencies remain null. No exchange-rate conversion."};
});}
export async function deletePersonalAccount(input:unknown){return actionResult(async()=>{
 const {password,confirmation,stopRenewals}=z.object({password:z.string().min(1).max(128),confirmation:z.literal("DELETE MY ACCOUNT"),stopRenewals:z.literal(true)}).strict().parse(input);void confirmation;void stopRenewals;
 const owner=await requireUserId(),session=await auth.api.getSession({headers:await headers(),query:{disableCookieCache:true}});if(!session)throw new PublicError("Sign in again");
 await auth.api.signInEmail({headers:await headers(),body:{email:session.user.email,password}});
 await reconcileNativeMembership(owner);
 const sources=(await billingSources(owner)).filter(source=>source.provider!=='stripe');
 const native=sourceEntitlement(sources,billingEnvironment());
 if(native.selected&&!native.renewalOff)throw new PublicError('Cancel renewal in Apple App Store or Google Play first, then confirm membership status and retry deletion. Account deletion cannot cancel a store subscription.');
 const member=await membershipFor(owner);
 await accountSql`INSERT INTO b1_deletions(user_id,product,customer_id,subscription_id) VALUES(${owner},${PERSONAL_PRODUCT},${member?.customer_id??null},${member?.subscription_id??null}) ON CONFLICT(user_id,product) DO NOTHING`;
 await processDeletion(owner);await auth.api.signOut({headers:await headers()});return {deleted:true};
});}
