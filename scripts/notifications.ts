import "dotenv/config";
import {readFile} from "node:fs/promises";
import {neon} from "@neondatabase/serverless";
import {PERSONAL_PRODUCT} from "../lib/account/config";

async function main(){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");
 const sql=neon(process.env.DATABASE_URL);
 if(process.argv.includes("--migrate")){
  const migration=await readFile(new URL("../lib/db/0024_internal_inbox.sql",import.meta.url),"utf8");
  await sql.transaction(migration.split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s)));
  console.log("Additive internal inbox migration applied. Source records, authentication and billing unchanged.");return;
 }
 const resetTest=process.argv.includes("--test-reset"),test=process.argv.includes("--test")||resetTest,publish=process.argv.indexOf("--publish");
 if(!test&&publish<0)throw new Error("Use --migrate, --test, or --publish path/to/message.json");
 let input:unknown,testOwner:string|null=null;
 if(test){
  const origin=new URL(process.env.APP_URL||process.env.BETTER_AUTH_URL||"http://localhost:3000");
  if(origin.origin!=="http://localhost:3000"||process.env.NODE_ENV==="production"||process.env.VERCEL)throw new Error("Test publication is limited to localhost development");
  const users=await sql`SELECT id FROM "user" WHERE email='test@test.com'`;
  if(users.length!==1)throw new Error("Expected one existing designated test account; none will be created");
  const owner=String(users[0].id);
  testOwner=owner;
  // Process-only test authorization. Does not change deployment privileges.
  process.env.NOTIFICATION_OPERATOR_IDS=owner;
  input={id:"764d4b88-35cb-470d-a8d4-3d724d4f3488",product:PERSONAL_PRODUCT,actor:owner,recipients:[owner],title:"Development inbox test",body:"This test message verifies your ManForth inbox. Opening it marks this message read. Read, unread and archive state are saved to your account. No email or push notification was sent.",availableAt:"2026-10-03T00:00:00.000Z",expiresAt:null,target:null};
 }else{
  const path=process.argv[publish+1];if(!path)throw new Error("Provide a message JSON file");
  input=JSON.parse(await readFile(path,"utf8"));
 }
 // Run with --conditions=react-server: the application service is server-only.
 const {publishAppMessage,inboxDetail,setInboxState}=await import("../lib/notifications/store");
 const result=await publishAppMessage(input);
 if(resetTest&&testOwner){
  const rows=await sql`SELECT id FROM b1_notifications WHERE user_id=${testOwner} AND product=${PERSONAL_PRODUCT} AND dedup_key=${`app:${result.id}`}`;
  if(rows.length!==1)throw new Error("Designated test message unavailable");
  let message=await inboxDetail(testOwner,String(rows[0].id));
  if(message.archivedAt){await setInboxState(testOwner,{id:message.id,revision:message.revision,archived:false});message=await inboxDetail(testOwner,message.id);}
  if(message.readAt)await setInboxState(testOwner,{id:message.id,revision:message.revision,read:false});
 }
 console.log(JSON.stringify({messageId:result.id,recipientCount:result.recipients,internalOnly:true}));
}
main().catch(error=>{console.error("Notification command failed:",error instanceof Error?error.message:"Unavailable", typeof error?.code==="string"?error.code:"");process.exitCode=1;});
