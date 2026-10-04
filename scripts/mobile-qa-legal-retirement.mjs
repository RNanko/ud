import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { QA_DATABASE } from './mobile-qa-connection.mjs';

export const legalTables = ['b1_legal_documents','b1_legal_active','b1_legal_signup_choices','b1_legal_signup_reservations','b1_legal_acceptances','b1_legal_purchases'];
const terms = 'b1-way-personal:terms:en:mobile-qa-1', privacy = 'b1-way-personal:privacy:en:mobile-qa-1';
const fixtureId = /^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/;
export function assertSyntheticLegalRows(rows) {
  const reject = () => { throw Error('QA legal retirement refused: non-synthetic or unrecognized evidence exists. No rows may be removed.'); };
  for (const name of legalTables) if (!Array.isArray(rows[name])) reject();
  for (const name of ['b1_legal_signup_choices','b1_legal_signup_reservations','b1_legal_purchases']) if (rows[name].length) reject();
  for (const d of rows.b1_legal_documents) if (![terms,privacy].includes(d.id) || d.product !== 'b1-way-personal' || d.locale !== 'en' || d.version !== 'mobile-qa-1' || d.content?.operator?.name !== 'QA fixture' || d.content?.introduction !== 'Isolated test content. This is not approval or publication of production policies.') reject();
  for (const a of rows.b1_legal_active) if (a.product !== 'b1-way-personal' || a.locale !== 'en' || a.terms_id !== terms || a.privacy_id !== privacy || a.purchase_ready !== false) reject();
  for (const a of rows.b1_legal_acceptances) if (!fixtureId.test(a.user_id) || a.id !== `fixture:${a.user_id}` || a.product !== 'b1-way-personal' || a.context !== 'registration' || a.locale !== 'en' || a.terms_id !== terms || a.privacy_id !== privacy || a.receipt?.syntheticQA !== true) reject();
}
const identifier = value => `"${value.replaceAll('"','""')}"`;

// Called inside the upgrader's transaction. Only this named database may retire
// its known synthetic fixtures; the shared migration still refuses real history.
export async function prepareQaLegalRetirement(db, root) {
  if ((await db.query('SELECT current_database() AS name')).rows[0].name !== QA_DATABASE) throw Error('Legal retirement is restricted to qa_tablename.');
  const names = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
  for (const name of names) await db.query(`LOCK TABLE public.${identifier(name)} IN ${legalTables.includes(name) ? 'ACCESS EXCLUSIVE' : 'SHARE'} MODE`);
  const rows = {};
  for (const name of legalTables) rows[name] = names.includes(name) ? (await db.query(`SELECT * FROM public.${identifier(name)}`)).rows : [];
  assertSyntheticLegalRows(rows);
  for (const a of rows.b1_legal_acceptances) {
    const owner = (await db.query('SELECT email FROM public."user" WHERE id=$1',[a.user_id])).rows[0];
    if (!owner?.email.endsWith('@example.invalid')) throw Error('Legal fixture owner is not an isolated synthetic identity.');
  }
  const retained = names.filter(name => !legalTables.includes(name));
  async function signatures() {
    const result = {};
    for (const name of retained) result[name] = (await db.query(`SELECT count(*)::text AS count, md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS checksum FROM public.${identifier(name)} t`)).rows[0];
    return JSON.stringify(result);
  }
  const before = await signatures();
  const count = Object.values(rows).reduce((n,r) => n+r.length,0);
  if (count) {
    // Recoverable legal-only archive: no user credentials, sessions or product data.
    writeFileSync(resolve(root,'.mobile-dev',`retired-qa-legal-${randomUUID()}.json`), JSON.stringify({ database:QA_DATABASE, retiredAt:new Date().toISOString(), rows }), {flag:'wx',mode:0o600});
    for (const name of [...legalTables].reverse()) if (names.includes(name)) await db.query(`DELETE FROM public.${identifier(name)}`);
  }
  return { count, async verifyRetained() { if (await signatures() !== before) throw Error('An unrelated QA application record changed; rollback required.'); return retained.length; } };
}
