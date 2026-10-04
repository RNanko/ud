import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { assertSyntheticLegalRows, legalTables } from '../scripts/mobile-qa-legal-retirement.mjs';
import { qaFixturePath } from '../scripts/mobile-qa-fixtures.mjs';

test('QA legal retirement rejects real or unfamiliar evidence, including disguised fixture owners',()=>{
 const empty=()=>Object.fromEntries(legalTables.map(name=>[name,[]]));assert.doesNotThrow(()=>assertSyntheticLegalRows(empty()));
 for(const name of legalTables){const rows=empty();rows[name]=[{id:'production-record',user_id:'real-owner'}];assert.throws(()=>assertSyntheticLegalRows(rows),/refused/);}
 const acceptance={user_id:'qa-mobile-0123456789abcdef-alex',id:'fixture:qa-mobile-0123456789abcdef-alex',product:'b1-way-personal',context:'registration',locale:'en',terms_id:'b1-way-personal:terms:en:mobile-qa-1',privacy_id:'b1-way-personal:privacy:en:mobile-qa-1',receipt:{syntheticQA:true}};
 const rows=empty();rows.b1_legal_acceptances=[acceptance];assert.doesNotThrow(()=>assertSyntheticLegalRows(rows));
 for(const replacement of [{receipt:{}},{user_id:'real-owner'},{context:'purchase'},{terms_id:'live-policy'},{product:'language'}]){rows.b1_legal_acceptances=[{...acceptance,...replacement}];assert.throws(()=>assertSyntheticLegalRows(rows),/refused/);}
});
test('fixture-set paths remain inside ignored local fixtures and never overwrite another set',()=>{
 const root=process.cwd();assert.match(qaFixturePath(root,'fixture-accounts.json',['--fixture-set=phase3-static']),/fixture-accounts-phase3-static\.json$/);
 for(const input of ['../secret','', 'C:/outside', 'UPPER'])assert.throws(()=>qaFixturePath(root,'fixture-accounts.json',[`--fixture-set=${input}`]));
 assert.throws(()=>qaFixturePath(root,'fixture-accounts.json',['--fixture-set=a','--fixture-set=b']));
});
test('shared static-policy migration refuses populated registry atomically; empty retirement preserves unrelated records',async()=>{
 const db=await PGlite.create();try{
  await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES(\'existing-owner\'); CREATE TABLE user_events(id text,data jsonb); INSERT INTO user_events VALUES(\'saved-event\',\'{"completed":true}\');');
  for(const name of legalTables)await db.exec(`CREATE TABLE ${name}(id text)`);
  await db.exec("INSERT INTO b1_legal_acceptances VALUES('retained-real-history')");
  const sql=readFileSync('lib/db/0027_static_legal_pages.sql','utf8');await assert.rejects(db.exec(sql),/contains records/);
  for(const name of legalTables)assert.ok((await db.query('SELECT to_regclass($1) AS name',[name])).rows[0].name);
  assert.equal((await db.query('SELECT id FROM b1_legal_acceptances')).rows[0].id,'retained-real-history');
  // Only ephemeral test data is cleared here; never a provider/application DB.
  await db.exec('DELETE FROM b1_legal_acceptances');await db.exec(sql);await db.exec(sql);
  for(const name of legalTables)assert.equal((await db.query('SELECT to_regclass($1) AS name',[name])).rows[0].name,null);
  assert.equal((await db.query('SELECT id FROM "user"')).rows[0].id,'existing-owner');assert.deepEqual((await db.query('SELECT data FROM user_events')).rows[0].data,{completed:true});
 }finally{await db.close();}
});
