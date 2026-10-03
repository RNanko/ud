import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import assert from 'node:assert/strict';
import { loadModule } from '../tests/helpers.mjs';
import { legalValidation, legalReview, legalTypes } from '../tests/legal-fixture.mjs';
if(!process.argv.includes('--isolated'))throw Error('Use --isolated. This creates/deletes only a random QA schema and never calls email/Stripe.');
const schema=`b1_legal_qa_${randomBytes(8).toString('hex')}`;
if(!/^b1_legal_qa_[a-f0-9]{16}$/.test(schema))throw Error('Invalid QA schema');
const raw=neon(process.env.DATABASE_URL),search=`SET LOCAL search_path TO "${schema}",pg_temp`;
async function query(text,values=[]){
 if(/\bpublic\./.test(text)&&!text.includes("'public.user'::regclass"))throw Error('Unscoped QA query');
 text=text.replaceAll("'public.user'::regclass",`'"${schema}"."user"'::regclass`);
 return (await raw.transaction([raw.query(search),raw.query(text,values)]))[1];
}
const accountSql=(parts,...values)=>query(parts.map((part,i)=>part+(i<values.length?`$${i+1}`:'')).join(''),values);
const config=loadModule('lib/account/config.ts');
const repository=loadModule('lib/legal/store.ts',{'../account/store':{accountSql},'../account/config':config,'./drafts':{allowDraftPreview:()=>false},'./validation':legalValidation});
function document(kind,version='fixture-1'){
 return {id:`b1-way-personal:${kind}:en:${version}`,product:'b1-way-personal',locale:'en',kind,version,title:`${kind} QA only`,introduction:'Test data in temporary schema. Not published legal approval.',effectiveDate:'2026-10-03',updatedAt:'2026-10-03',operator:{name:'QA fixture',form:'Fixture',country:'Fixture',address:'Fixture',registration:'Not applicable in fixture',tax:'Not applicable in fixture',contact:'fixture@example.invalid'},sections:Array.from({length:8},(_,i)=>({id:`section-${i}`,title:`Section ${i}`,paragraphs:['Isolated test content']})),...(kind==='terms'?{offer:{annualPrices:config.annualPrices,trialDays:14,currencyPolicy:'Fixture'}}:{})};
}
const terms=document('terms'),privacy=document('privacy');
async function insertDoc(doc){await accountSql`INSERT INTO b1_legal_documents(id,product,locale,kind,version,content,content_hash,status,review,published_at) VALUES(${doc.id},${doc.product},${doc.locale},${doc.kind},${doc.version},${JSON.stringify(doc)},${legalValidation.contentHash(doc)},'published',${JSON.stringify(legalReview)},now())`;}
async function proof(id,user,email=`${user}@example.invalid`){await accountSql`INSERT INTO b1_email_attempts(id,token_hash,email,purpose,user_id,code_digest,expires_at,verified_at) VALUES(${id},${id},${email},'signup',${user},'never-used',now()+interval '10 minutes',now())`;return (await accountSql`SELECT * FROM b1_email_attempts WHERE id=${id}`)[0];}
async function insertUser(id){return accountSql`INSERT INTO "user"(id,name,email,email_verified) VALUES(${id},'QA only',${`${id}@example.invalid`},true)`;}
let checks=0;
try{
 await raw.query(`CREATE SCHEMA "${schema}"`);
 for(const table of ['user','b1_email_attempts','account'])await raw.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
 const ddl=(await readFile('lib/db/0022_legal_documents.sql','utf8')).replaceAll('public.',`"${schema}".`).replace('SET search_path = public, pg_temp',`SET search_path = "${schema}", pg_temp`);
 await raw.transaction(ddl.split('--> statement-breakpoint').filter(v=>v.trim()).map(v=>raw.query(v)));
 assert.equal(await repository.publishedBundle(),null);checks++;
 await insertDoc(terms);await insertDoc(privacy);
 await accountSql`INSERT INTO b1_legal_active(product,locale,terms_id,privacy_id,statement_version,statement,purchase_ready) VALUES('b1-way-personal','en',${terms.id},${privacy.id},${legalTypes.agreementStatement.version},${legalTypes.agreementStatement.text},true)`;
 const bundle=await repository.publishedBundle(),agreement=legalTypes.agreementFor(bundle);assert.ok(bundle);checks++;
 const state=await proof('qa-proof','qa-owned');
 const choices=await Promise.all(Array.from({length:12},()=>repository.recordSignupAgreement(state,agreement)));
 assert.equal(new Set(choices).size,1);checks++;
 await repository.reserveSignup(state,choices[0]);
 await assert.rejects(repository.assertSignupReservation('qa-owned','qa-owned@example.invalid'));checks++;
 await accountSql`UPDATE b1_email_attempts SET consumed_at=now() WHERE id='qa-proof'`;
 await repository.assertSignupReservation('qa-owned','qa-owned@example.invalid');
 const duplicate=await Promise.allSettled(Array.from({length:12},()=>insertUser('qa-owned')));
 assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await accountSql`SELECT count(*) AS n FROM b1_legal_acceptances WHERE user_id='qa-owned'`)[0].n,'1');checks++;
 const receipt=(await repository.legalAccountHistory('qa-owned')).records[0];
 assert.equal(legalValidation.contentHash(receipt.receipt.terms),legalValidation.contentHash(terms));assert.equal(receipt.receipt.privacyNoticeAcknowledgment,true);assert.equal(receipt.receipt.termsAcceptance,true);
 assert.ok(receipt.terms_accepted_at);checks++;
 await assert.rejects(accountSql`UPDATE b1_legal_acceptances SET statement='tampered' WHERE user_id='qa-owned'`);
 await assert.rejects(accountSql`UPDATE b1_legal_documents SET content='{}' WHERE id=${terms.id}`);checks++;
 // Simulate a credential failure after user insert in the same adapter transaction.
 const failed=await proof('qa-failed','qa-failed');const choice=await repository.recordSignupAgreement(failed,agreement);await repository.reserveSignup(failed,choice);
 await accountSql`UPDATE b1_email_attempts SET consumed_at=now() WHERE id='qa-failed'`;
 await assert.rejects(raw.transaction([raw.query(search),raw.query(`INSERT INTO "user"(id,name,email,email_verified) VALUES('qa-failed','QA','qa-failed@example.invalid',true)`),raw.query(`INSERT INTO account(id) VALUES(NULL)`)]));
 assert.equal((await accountSql`SELECT count(*) AS n FROM "user" WHERE id='qa-failed'`)[0].n,'0');assert.equal((await accountSql`SELECT count(*) AS n FROM b1_legal_acceptances WHERE user_id='qa-failed'`)[0].n,'0');checks++;
 const changed=await proof('qa-changed','qa-changed');const changedChoice=await repository.recordSignupAgreement(changed,agreement);await repository.reserveSignup(changed,changedChoice);
 const updated=document('terms','fixture-2');await insertDoc(updated);
 await accountSql`UPDATE b1_legal_active SET terms_id=${updated.id} WHERE product='b1-way-personal' AND locale='en'`;
 await assert.rejects(repository.recordSignupAgreement(changed,agreement),/LEGAL_VERSIONS_CHANGED/);
 assert.equal((await accountSql`SELECT consumed_at FROM b1_email_attempts WHERE id='qa-changed'`)[0].consumed_at,null);checks++;
 await accountSql`UPDATE b1_email_attempts SET consumed_at=now() WHERE id='qa-changed'`;
 await assert.rejects(insertUser('qa-changed'));assert.equal(await repository.signupFinalized('qa-changed'),false);checks++;
 const newAgreement=legalTypes.agreementFor(await repository.publishedBundle());
 await Promise.all(Array.from({length:8},()=>repository.purchaseLegalSnapshot('qa-owned','qa-operation','EUR','price_fixture',newAgreement)));
 const own=await repository.legalAccountHistory('qa-owned');assert.equal(own.purchases.length,1);assert.equal(own.records.length,2);assert.equal(own.purchases[0].amount,1000);checks++;
 assert.equal((await repository.legalAccountHistory('different-owner')).records.length,0);assert.equal((await repository.legalAccountHistory('different-owner')).purchases.length,0);checks++;
 await assert.rejects(repository.purchaseLegalSnapshot('qa-owned','qa-operation','USD','price_changed',newAgreement));checks++;
 const again=(await repository.legalAccountHistory('qa-owned')).records.find(r=>r.context==='registration');assert.equal(legalValidation.contentHash(again.receipt.terms),legalValidation.contentHash(terms));assert.equal(new Date(again.terms_accepted_at).getTime(),new Date(receipt.terms_accepted_at).getTime());checks++;
 await repository.deletePendingLegal('qa-owned');await accountSql`DELETE FROM "user" WHERE id='qa-owned'`;
 assert.equal((await accountSql`SELECT count(*) AS n FROM b1_legal_acceptances WHERE user_id='qa-owned'`)[0].n,'0');assert.equal((await accountSql`SELECT count(*) AS n FROM b1_legal_purchases WHERE user_id='qa-owned'`)[0].n,'0');checks++;
 console.log(`PASS: ${checks} isolated legal database checks: atomic evidence/identity rollback, concurrent duplicate prevention, version changes, immutable history, exact offers, ownership and deletion. No provider calls or production users/documents changed.`);
}finally{await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}
