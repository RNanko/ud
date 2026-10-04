// Local synthetic QA mailbox inspection. Codes are never logged or bundled.
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash,createDecipheriv} from 'node:crypto';import dotenv from 'dotenv';import {neon} from '@neondatabase/serverless';import {qaDatabaseUrl} from './qa-database.mjs';import {verifyQaConnection} from './mobile-qa-connection.mjs';import {qaFixturePath} from './mobile-qa-fixtures.mjs';
const root=resolve(import.meta.dirname,'..');
async function main(){
 const options=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),app=dotenv.parse(readFileSync(resolve(root,'.env'))),connection=qaDatabaseUrl({...app,...options});await verifyQaConnection(connection);
 const accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase4-account-final.json')));if(!accounts.length||!accounts.every(a=>/^qa-mobile-[a-f0-9]{16}-/.test(a.id)&&a.email.endsWith('@example.invalid')))throw Error('Only labeled synthetic QA accounts may be inspected.');
 const key=createHash('sha256').update(readFileSync(resolve(root,'.mobile-dev/email-secret'),'utf8').trim()).digest(),sql=neon(connection);
 const rows=await sql`SELECT p.owner_id,p.email,p.purpose,p.expires_at,o.payload FROM b1_email_attempts p JOIN b1_email_outbox o ON o.kind='code:'||p.id::text||':'||p.version::text WHERE p.owner_id=ANY(${accounts.map(a=>a.id)}::text[]) AND p.consumed_at IS NULL AND p.expires_at>now() AND p.purpose IN('verify-account','email-change') AND o.payload<>''`;
 const codes=rows.map(row=>{const bytes=Buffer.from(row.payload,'base64url'),d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));const mail=JSON.parse(Buffer.concat([d.update(bytes.subarray(28)),d.final()]));return {owner:row.owner_id,email:row.email,purpose:row.purpose,expiresAt:row.expires_at,code:mail.text.match(/code is (\d{6})/)[1]};});
 writeFileSync(resolve(root,'.mobile-dev','qa-mailbox-codes.json'),JSON.stringify(codes,null,2),{mode:0o600});console.log('Saved '+codes.length+' current synthetic mailbox codes to the ignored local QA mailbox file. No email sent; codes withheld.');
}
main().catch(()=>{console.error('Synthetic QA mailbox inspection failed; private diagnostics withheld.');process.exitCode=1;});
