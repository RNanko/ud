import test from 'node:test';
import assert from 'node:assert/strict';
import { assertQaIdentity } from '../scripts/mobile-qa-connection.mjs';
import { qaDatabaseUrl } from '../scripts/qa-database.mjs';

const identity = { database: 'qa_tablename', role: 'manforth_mobile_qa', login: true, superuser: false, create_database: false, create_role: false, replication: false, bypass_rls: false, memberships: false, database_owner: false, create_schema: false, create_database_objects: false };
test('QA runtime must be the intended database and an unprivileged non-owner role', () => {
  assert.doesNotThrow(() => assertQaIdentity(identity));
  for (const flag of ['superuser','create_database','create_role','replication','bypass_rls','memberships','database_owner','create_schema','create_database_objects']) assert.throws(() => assertQaIdentity({ ...identity, [flag]: true }));
  for (const patch of [{ database: 'neondb' }, { role: 'neondb_owner' }, { login: false }]) assert.throws(() => assertQaIdentity({ ...identity, ...patch }));
});
test('direct/pooled host aliases and encoded database names cannot establish QA separation', () => {
  const DATABASE_URL = 'postgres://app:secret@ep-example-pooler.us-east-1.aws.neon.tech/app';
  for (const QA_DATABASE_URL of ['postgres://qa:other@ep-example.us-east-1.aws.neon.tech/app', 'postgres://qa:other@ep-example-pooler.us-east-1.aws.neon.tech:5432/%61pp?schema=qa']) {
    assert.throws(() => qaDatabaseUrl({ DATABASE_URL, QA_DATABASE_URL, QA_DATABASE_ISOLATED: 'true' }));
  }
  assert.equal(qaDatabaseUrl({ DATABASE_URL, QA_DATABASE_URL: 'postgres://qa:other@ep-example.us-east-1.aws.neon.tech/qa_tablename', QA_DATABASE_ISOLATED: 'true' }).endsWith('/qa_tablename'), true);
});
