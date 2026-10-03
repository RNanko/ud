"use server";
import { headers } from "next/headers";
import z from "zod";
import { auth } from "../auth";
import { requireUserId } from "../session";
import { actionResult } from "../account/result";
import { accountSql, accountSettings, membershipFor } from "../account/store";
import { PERSONAL_PRODUCT } from "../account/config";
import { processDeletion } from "../account/privacy";
import { legalAccountHistory } from "../legal/store";
export async function exportAccountData(){return actionResult(async()=>{
 const owner=await requireUserId(),users=await accountSql`SELECT id,name,email,email_verified,created_at FROM "user" WHERE id=${owner}`;
 const tables=["finance_table","finance_categories","investment_positions","gym_entities","gym_plans","gym_sessions","gym_rest_days","kanban_board","user_events","user_notes","momentum_state"];
 const results=await Promise.all(tables.map(table=>accountSql.query(`SELECT * FROM "${table}" WHERE user_id=$1`,[owner])));
 const membership=await membershipFor(owner),settings=await accountSettings(owner),legal=await legalAccountHistory(owner);
 const billing=membership?{product:PERSONAL_PRODUCT,trialStartedAt:membership.trial_started_at,trialEndsAt:membership.trial_ends_at,paidThrough:membership.paid_through,billingCurrency:membership.billing_currency,renewalOff:membership.renewal_off,status:membership.status}:null;
 const likes=await accountSql`SELECT q.id,q.author,q.quote FROM quote_likes l JOIN quotes q ON q.id=l.quote_id WHERE l.user_id=${owner}`;
 return {schemaVersion:2,exportedAt:new Date().toISOString(),product:PERSONAL_PRODUCT,account:users[0],settings,membership:billing,legal,data:{...Object.fromEntries(tables.map((table,index)=>[table,results[index]])),likedQuotes:likes},measurementPolicy:"Gym loads and distances are stored as kg/km with the recorded load basis. Missing values remain null. Unrecorded finance currencies remain null. No exchange-rate conversion."};
});}
export async function deletePersonalAccount(input:unknown){return actionResult(async()=>{
 const {password,confirmation,stopRenewals}=z.object({password:z.string().min(1).max(128),confirmation:z.literal("DELETE MY ACCOUNT"),stopRenewals:z.literal(true)}).strict().parse(input);void confirmation;void stopRenewals;
 const owner=await requireUserId(),session=await auth.api.getSession({headers:await headers(),query:{disableCookieCache:true}});if(!session)throw new Error("Sign in again");
 await auth.api.signInEmail({headers:await headers(),body:{email:session.user.email,password}});
 const member=await membershipFor(owner);
 await accountSql`INSERT INTO b1_deletions(user_id,product,customer_id,subscription_id) VALUES(${owner},${PERSONAL_PRODUCT},${member?.customer_id??null},${member?.subscription_id??null}) ON CONFLICT(user_id,product) DO NOTHING`;
 await processDeletion(owner);await auth.api.signOut({headers:await headers()});return {deleted:true};
});}
