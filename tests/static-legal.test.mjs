import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadModule, plain} from './helpers.mjs';
import {publicContent, publicEnv, staticStore, signupRepository} from './static-legal-fixture.mjs';
import {legalValidation, legalTypes} from './legal-fixture.mjs';

test('public website policies use only named operator facts, omit blanks and have deterministic content-derived references', async()=>{
  const env={...publicEnv, DATABASE_URL:'PRIVATE_DATABASE', RESEND_API_KEY:'PRIVATE_SECRET', LEGAL_DRAFT_PREVIEW:'true'};
  const documents=publicContent.publicDocuments(env);
  assert.equal(documents.terms.operator.registration,''); assert.equal(documents.privacy.operator.tax,'');
  const serialized=JSON.stringify(documents);
  assert.doesNotMatch(serialized,/PRIVATE_SECRET|PRIVATE_DATABASE|REVIEW REQUIRED|TODO|Registration:|Tax\/VAT:/);
  assert.deepEqual(plain(publicContent.publicDocuments(env)),plain(documents));
  const changed=publicContent.publicDocuments({...env,LEGAL_OPERATOR_ADDRESS:'New synthetic address'});
  assert.notEqual(changed.terms.id,documents.terms.id); assert.notEqual(changed.privacy.id,documents.privacy.id);
  assert.match(JSON.stringify(publicContent.publicDocuments({...env,LEGAL_OPERATOR_REGISTRATION:'Synthetic registration'})),/Registration: Synthetic registration/);
  const store=staticStore(env),bundle=await store.publishedBundle();
  assert.equal(bundle.terms.href,'/terms');assert.equal(bundle.privacy.href,'/privacy');assert.equal(bundle.purchaseReady,true);
  assert.equal((await store.publicDocument('privacy')).draft,false);
  assert.equal(await store.publicDocument('privacy','old-version'),null);
  assert.equal(legalValidation.validateAgreement(legalTypes.agreementFor(bundle),bundle).accepted,true);
  assert.throws(()=>legalValidation.validateAgreement({...legalTypes.agreementFor(bundle),accepted:false},bundle));
  for(const key of Object.keys(publicEnv))assert.equal(publicContent.publicDocuments({...publicEnv,[key]:''}),null);
});

test('anonymous policy downloads expose the current copy without sessions or database queries',async()=>{
  const store=staticStore();
  const route=loadModule('app/api/public/legal/document/route.ts',{'@/lib/legal/store':store,'@/lib/legal/validation':legalValidation});
  for(const kind of ['terms','privacy']){
    const document=(await store.publicDocument(kind)).document;
    const response=await route.GET(new Request(`http://localhost/api/public/legal/document?kind=${kind}&version=${document.version}`));
    assert.equal(response.status,200);const copy=await response.json();assert.equal(copy.sha256,legalValidation.contentHash(copy.document));assert.deepEqual(copy.document,plain(document));
  }
});

function sqlFor(db){return async(parts,...values)=> (await db.query(parts.map((part,i)=>part+(i<values.length?`$${i+1}`:'')).join(''),values)).rows;}
const baseDDL=`CREATE TABLE public."user"(id text PRIMARY KEY,email text,email_verified boolean);
  CREATE TABLE public.account(id text PRIMARY KEY,user_id text,provider_id text,password text);
  CREATE TABLE public.b1_email_attempts(id text PRIMARY KEY,user_id text,purpose text,owner_id text,email text,verified_at timestamptz,consumed_at timestamptz,expires_at timestamptz);
  CREATE TABLE public.b1_memberships(id text PRIMARY KEY); CREATE TABLE public.session(id text PRIMARY KEY);`;
test('signup proof remains verified, unexpired, owned and single-purpose after removing legal persistence',async()=>{
  const db=new PGlite();try{
    await db.exec(baseDDL);const repository=signupRepository(sqlFor(db));
    await db.exec(`INSERT INTO b1_email_attempts VALUES('proof','owner','signup',NULL,'fixture@example.invalid',now(),now(),now()+interval '10 minutes')`);
    await repository.assertVerifiedSignupProof('owner','FIXTURE@example.invalid');
    for(const [owner,email] of [['other','fixture@example.invalid'],['owner','other@example.invalid']])await assert.rejects(repository.assertVerifiedSignupProof(owner,email));
    for(const update of ["verified_at=NULL", "consumed_at=NULL", "expires_at=now()-interval '1 minute'", "owner_id='other'", "purpose='email-change'"]){
      await db.exec('BEGIN');await db.exec(`UPDATE b1_email_attempts SET ${update}`);
      await assert.rejects(repository.assertVerifiedSignupProof('owner','fixture@example.invalid'));await db.exec('ROLLBACK');
    }
    assert.equal(await repository.signupFinalized('owner'),false);
    await db.exec(`INSERT INTO "user" VALUES('owner','fixture@example.invalid',true); INSERT INTO account VALUES('credential','owner','credential','protected-test-value')`);
    assert.equal(await repository.signupFinalized('owner'),true);assert.equal(await repository.signupFinalized('other'),false);
  }finally{await db.close();}
});

const retirement=readFileSync('lib/db/0027_static_legal_pages.sql','utf8');
const legalDDL=readFileSync('lib/db/0022_legal_documents.sql','utf8').replaceAll('--> statement-breakpoint','');
test('empty legal registry retirement is atomic, repeatable and preserves account/security/membership rows',async()=>{
  const db=new PGlite();try{
    await db.exec(baseDDL);await db.exec(legalDDL);
    await db.exec(`INSERT INTO "user" VALUES('existing','fixture@example.invalid',true); INSERT INTO b1_memberships VALUES('membership'); INSERT INTO session VALUES('session'); INSERT INTO b1_email_attempts(id) VALUES('existing-proof')`);
    await db.exec(retirement);await db.exec(retirement);
    for(const table of ['user','b1_memberships','session','b1_email_attempts'])assert.equal((await db.query(`SELECT count(*)::integer AS count FROM "${table}"`)).rows[0].count,1);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'b1_legal_%'`)).rows[0].count,0);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM pg_trigger WHERE tgname='b1_finalize_signup_legal'`)).rows[0].count,0);
  }finally{await db.close();}
});
test('retirement refuses a nonempty registry and retains its tables, trigger and history',async()=>{
  const db=new PGlite();try{
    await db.exec(baseDDL);await db.exec(legalDDL);
    await db.exec(`INSERT INTO b1_legal_documents(id,product,locale,kind,version,content,content_hash) VALUES('historic','b1-way-personal','en','terms','historic','{}','hash')`);
    await assert.rejects(db.exec(retirement),/contains records/);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM b1_legal_documents')).rows[0].count,1);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'b1_legal_%'`)).rows[0].count,6);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM pg_trigger WHERE tgname='b1_finalize_signup_legal'`)).rows[0].count,1);
  }finally{await db.close();}
});
