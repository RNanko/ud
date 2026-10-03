import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { loadModule } from '../tests/helpers.mjs';

// Manual operator preview only. No web endpoint; normal reminders keep their
// owned, encrypted outbox, opt-in, suppression and quota checks.
const send = process.argv.includes('--send');
const recipientVariable = process.argv.find(value => value.startsWith('--recipient-env='))?.split('=')[1] ?? 'TEST_CUSTOMER_EMEIL';
if (!/^[A-Z][A-Z0-9_]*$/.test(recipientVariable)) throw Error('Choose an environment variable name');
const recipient = send ? process.env[recipientVariable]?.trim().toLowerCase() : 'preview@example.invalid';
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw Error('The test recipient is not configured');
const templates = loadModule('lib/account/email/templates.ts');
const config = loadModule('lib/account/config.ts');
const mail = templates.testMail(recipient, config.appOrigin());
await writeFile('public/email-preview.html', mail.html, 'utf8');
const verificationPreview=templates.verificationMail('preview@example.invalid','000123').html.replace('One small step before you get started. Enter this code in the app to confirm your email address.','This is a visual preview. The sample code below is not a working verification code.');
await writeFile('public/email-verification-preview.html', verificationPreview, 'utf8');
await mkdir('docs/email', {recursive:true});
await writeFile('docs/email/b1-way-template.html',mail.html,'utf8');
await writeFile('docs/email/b1-way-template.txt',mail.text,'utf8');
console.log(JSON.stringify({preview:'http://localhost:3000/email-preview.html',verificationPreview:'http://localhost:3000/email-verification-preview.html',htmlBytes:Buffer.byteLength(mail.html),sending:send}));
if (!send) process.exit(0);
if (!process.env.RESEND_API_KEY) throw Error('Resend is not configured');
const {brand,brandedEmailSender}=loadModule('lib/brand.ts');
const from=brandedEmailSender(process.env.RESEND_FROM_EMAIL);
const client=new Resend(process.env.RESEND_API_KEY);
const key=createHash('sha256').update(`${recipient}:${from}:${mail.html}`).digest('hex').slice(0,24);
await mkdir('email-test-receipts',{recursive:true});
const path=`email-test-receipts/${key}.json`;
let receipt;
try {receipt=JSON.parse(await readFile(path,'utf8'));} catch(error) {if(error.code!=='ENOENT')throw error;}
if (receipt?.accepted) {
  console.log(JSON.stringify({state:'already-accepted',emailId:receipt.emailId,recipient,subject:mail.subject}));process.exit(0);
}
if (receipt && Date.now()-Date.parse(receipt.createdAt)>23*3600000) throw Error('The previous test outcome needs manual review before sending again');
receipt ??= {createdAt:new Date().toISOString(),idempotencyKey:`b1/manual-email-test/${randomUUID()}`};
await writeFile(path,JSON.stringify(receipt),{encoding:'utf8',mode:0o600});
const result=await client.emails.send({from,to:recipient,replyTo:process.env.RESEND_REPLY_TO_EMAIL || brand.supportEmail,subject:`[Test] ${brand.productName} — ${mail.subject}`,html:mail.html,text:mail.text},{idempotencyKey:receipt.idempotencyKey});
if(result.error) {
  console.log(JSON.stringify({state:'rejected',error:result.error.name,detail:result.error.message}));process.exitCode=1;
} else {
  receipt.accepted=true;receipt.emailId=result.data.id;
  await writeFile(path,JSON.stringify(receipt),{encoding:'utf8',mode:0o600});
  console.log(JSON.stringify({state:'provider-accepted',emailId:receipt.emailId,recipient,from}));
  // Provider acceptance is not inbox delivery. Reading is optional for send-only keys.
  const status=await client.emails.get(receipt.emailId);
  console.log(JSON.stringify({deliveryStatus:status.data?.last_event ?? 'status-not-available'}));
}
