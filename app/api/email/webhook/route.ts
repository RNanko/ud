import { resendClient } from "@/lib/account/email/delivery";
import { accountSql } from "@/lib/account/store";
import { protectedKey } from "@/lib/account/email/crypto";
export async function POST(request:Request){
 const secret=process.env.RESEND_WEBHOOK_SECRET;if(!secret)return Response.json({error:"Webhook is not configured"},{status:503});
 const id=request.headers.get("svix-id"),timestamp=request.headers.get("svix-timestamp"),signature=request.headers.get("svix-signature");if(!id||!timestamp||!signature)return Response.json({error:"Missing signature"},{status:400});
 const raw=await request.text();let event;
 try{event=resendClient().webhooks.verify({payload:raw,headers:{id,timestamp,signature},webhookSecret:secret});}catch{return Response.json({error:"Invalid signature"},{status:400});}
 try{
  const suppressed=["email.bounced","email.complained"].includes(event.type),recipients="to" in event.data&&Array.isArray(event.data.to)?event.data.to.filter((value):value is string=>typeof value==="string").map(email=>protectedKey(email.toLowerCase())):[];
  // Provider idempotency and team-scoped suppression updates commit together.
  await accountSql.transaction([
   accountSql`INSERT INTO b1_provider_events(provider,event_id,payload,status) VALUES('resend',${id},${JSON.stringify({type:event.type,recipientKeys:recipients})}::jsonb,'processed') ON CONFLICT DO NOTHING`,
   ...recipients.filter(()=>suppressed).map(recipient=>accountSql`INSERT INTO b1_email_suppressions(scope,recipient_key,reason) VALUES(${process.env.EMAIL_SUPPRESSION_SCOPE||"b1-way-team"},${recipient},${event.type}) ON CONFLICT(scope,recipient_key) DO UPDATE SET reason=excluded.reason`)
  ]);
  return Response.json({received:true});
 }catch{return Response.json({error:"Durable webhook acceptance failed"},{status:503});}
}
