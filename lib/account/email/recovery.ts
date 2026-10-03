import { brand } from "../../brand";
import "server-only";
import { accountSql } from "../store";
import { launchPolicy, appOrigin } from "../config";
import { identityContext } from "../identity-context";
import { protectedKey } from "./crypto";
import { enqueueMail } from "./delivery";
import { mailTemplate } from "./templates";
export async function queueRecovery(user:{id:string;email:string},url:string,token:string){
 const context=identityContext();
 if(!context||!["recovery","migration"].includes(context.purpose)) throw new Error("Use the protected recovery form");
 const target=new URL(url); if(target.origin!==appOrigin()) throw new Error("Recovery origin is not allowed");
 const recipient=protectedKey(user.email),purpose=context.purpose,maximum=launchPolicy().recoverySendsPerDay;
 const accepted=await accountSql`INSERT INTO b1_email_ledgers(recipient_key,purpose,sends,first_at,last_at) VALUES(${recipient},${purpose},1,now(),now())
 ON CONFLICT(recipient_key,purpose) DO UPDATE SET sends=CASE WHEN b1_email_ledgers.first_at<now()-interval '24 hours' THEN 1 ELSE b1_email_ledgers.sends+1 END,
 first_at=CASE WHEN b1_email_ledgers.first_at<now()-interval '24 hours' THEN now() ELSE b1_email_ledgers.first_at END,last_at=now()
 WHERE (b1_email_ledgers.last_at IS NULL OR b1_email_ledgers.last_at<now()-interval '60 seconds') AND (b1_email_ledgers.sends<${maximum} OR b1_email_ledgers.first_at<now()-interval '24 hours') RETURNING 1`;
 if(!accepted[0]) return;
 await accountSql`INSERT INTO b1_recovery_claims(token_key,user_id,purpose,expires_at) VALUES(${protectedKey(token)},${user.id},${purpose},now()+interval '1 hour') ON CONFLICT DO NOTHING`;
 await enqueueMail(`recovery/${protectedKey(token)}`,"recovery",mailTemplate(user.email,purpose==="migration"?`Set your ${brand.productName} password`:`Reset your ${brand.productName} password`,["Use this single-use link within one hour.","If you did not request this, ignore this message. Your current account remains unchanged."],{href:url,label:purpose==="migration"?"Set password":"Reset password"}),new Date(Date.now()+3600000));
}
