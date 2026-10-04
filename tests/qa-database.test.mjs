import test from 'node:test';
import assert from 'node:assert/strict';
import {qaDatabaseUrl} from '../scripts/qa-database.mjs';
const env={QA_DATABASE_URL:'postgresql://fixture:fixture@qa.invalid/test',QA_DATABASE_ISOLATED:'true',DATABASE_URL:'postgresql://fixture:fixture@app.invalid/app'};
test('database QA commands require explicit isolated configuration before any client exists',()=>{
 assert.equal(qaDatabaseUrl(env),env.QA_DATABASE_URL);
 for(const patch of [{QA_DATABASE_URL:undefined},{QA_DATABASE_ISOLATED:'false'},{NODE_ENV:'production'},{VERCEL_ENV:'production'},{QA_DATABASE_URL:'https://qa.invalid/test'},{QA_DATABASE_URL:'postgres://other:other@app.invalid/app?sslmode=require'}])assert.throws(()=>qaDatabaseUrl({...env,...patch}));
});
test('connection rejection never exposes credentials, endpoint or database name',()=>{
 for(const patch of [{QA_DATABASE_URL:'postgresql://PRIVATE_FIXTURE:PRIVATE_FIXTURE@app.invalid/app'},{QA_DATABASE_URL:'PRIVATE_FIXTURE'},{DATABASE_URL:'PRIVATE_FIXTURE'}]){
  try{qaDatabaseUrl({...env,...patch});assert.fail('Expected rejection');}catch(error){assert.doesNotMatch(error.message,/PRIVATE_FIXTURE|app.invalid/);}
 }
});
