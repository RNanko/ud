import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHmac,createHash} from 'node:crypto';
/** Feature probes neither enqueue fixture mail nor accept an external provider delivery.
 * Other account-security fixtures may retain encrypted, undelivered mailbox codes. */
export async function assertNoQaFeatureMail(sql,root,accounts){
 assert.ok(accounts.length&&accounts.every(a=>/^qa-mobile-[a-f0-9]{16}-/.test(a.id)&&a.email.endsWith('@example.invalid')));
 assert.equal((await sql.query('SELECT current_database() AS name'))[0].name,'qa_tablename');
 const secret=readFileSync(resolve(root,'.mobile-dev/email-secret'),'utf8').trim();
 const recipients=accounts.map(a=>createHmac('sha256',createHmacKey(secret)).update(a.email.toLowerCase()).digest('hex'));
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM b1_email_outbox WHERE recipient_key=ANY($1::text[])',[recipients]))[0].n,0,'This feature queued unexpected fixture mail.');
 assert.equal((await sql.query("SELECT count(*)::int AS n FROM b1_email_outbox WHERE status='sent' OR provider_id IS NOT NULL"))[0].n,0,'External provider delivery must remain disabled in QA.');
}
const createHmacKey=secret=>createHash('sha256').update(secret).digest();
