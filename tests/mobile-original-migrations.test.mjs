import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { originalMobileMigrations, mobileOriginalFiles, mobileOriginalTables } from '../scripts/mobile-original-migrations.mjs';
function adapter({ database='neondb', changed=false, partial=false, fail=false, ledger=false, badHash=false }={}) {
  const queries=[];let installed=ledger, audited=0;
  return { queries, async query(sql,parameters) {
    queries.push(sql);
    if (sql.startsWith('SELECT current_database')) return { rows:[{database,role:'owner'}] };
    if (sql.startsWith('SELECT n AS name')) return {rows:mobileOriginalTables.map((name,i)=>({name,present:installed || partial && i===0}))};
    if (sql.startsWith('SELECT proname')) return {rows:installed ? [...new Set(mobileOriginalFiles.flatMap(name=>[...readFileSync('lib/db/'+name,'utf8').matchAll(/CREATE (?:OR REPLACE )?FUNCTION (b1_mobile_\w+)/g)].map(match=>match[1])))].map(name=>({name})) : []};
    if (sql.includes("to_regclass('b1_mobile_deployment_metadata")) return {rows:[{present:ledger}]};
    if (sql.startsWith('SELECT name,hash')) return {rows:mobileOriginalFiles.map(name=>({name,hash:badHash?'changed':createHash('sha256').update(readFileSync('lib/db/'+name,'utf8')).digest('hex')}))};
    if (sql.startsWith('SELECT count(*)')) return {rows:[{count:'2',fingerprint:changed && ++audited>13?'changed':'original'}]};
    if (sql.startsWith('INSERT INTO b1_mobile_deployment_metadata')) { if(fail) throw Error('write failed'); if(parameters[0]===mobileOriginalFiles.at(-1)) installed=true; }
    return {rows:[]};
  }};
}
test('original migration inspection requires explicit matching identity and never writes',async()=>{
  const db=adapter();await assert.rejects(()=>originalMobileMigrations(db,process.cwd()),/Explicit/);assert.equal(db.queries.length,0);
  await assert.rejects(()=>originalMobileMigrations(adapter({database:'qa_tablename'}),process.cwd(),{apply:true,expectedDatabase:'neondb'}),/identity/);
  const r=await originalMobileMigrations(db,process.cwd(),{expectedDatabase:'neondb'});assert.equal(r.missingTables.length,11);assert.equal(r.applied,false);assert.ok(!db.queries.some(q=>/BEGIN|CREATE|INSERT|UPDATE|DELETE|DROP/.test(q)));
});
test('reviewed original setup commits once only with unchanged canonical fingerprints; drift/failure/partial state rolls back',async()=>{
  const db=adapter();const r=await originalMobileMigrations(db,process.cwd(),{apply:true,expectedDatabase:'neondb'});assert.equal(r.preserved,true);assert.equal(db.queries.at(-1),'COMMIT');
  for(const options of [{changed:true},{fail:true},{partial:true}]) {const rejected=adapter(options);await assert.rejects(()=>originalMobileMigrations(rejected,process.cwd(),{apply:true,expectedDatabase:'neondb'}));assert.equal(rejected.queries.at(-1),'ROLLBACK');}
});
test('matching original deployment ledger is verification only; changed hashes cannot replay migrations',async()=>{
  const db=adapter({ledger:true});const result=await originalMobileMigrations(db,process.cwd(),{apply:true,expectedDatabase:'neondb'});assert.equal(result.alreadyApplied,true);assert.ok(!db.queries.some(q=>q.startsWith('CREATE')||q.startsWith('INSERT')));
  const bad=adapter({ledger:true,badHash:true});await assert.rejects(()=>originalMobileMigrations(bad,process.cwd(),{apply:true,expectedDatabase:'neondb'}));assert.equal(bad.queries.at(-1),'ROLLBACK');
});
