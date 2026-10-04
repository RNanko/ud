import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as nodeCrypto from 'node:crypto';
import {loadModule, hookHarness, findNode, jsxRuntime} from './helpers.mjs';
import {legalAgreement} from './legal-fixture.mjs';

test('real email reservations allow one resend after 60 seconds, block further sends for 24 hours, and still verify the latest code',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');const db=await PGlite.create();
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY, email text NOT NULL);');
    const migration=readFileSync('lib/db/0021_account_membership.sql','utf8');
    for(const table of ['b1_rate_buckets','b1_email_ledgers','b1_email_attempts','b1_email_outbox','b1_email_suppressions']) {
      await db.exec(migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} [\\s\\S]*?;`))[0]);
    }
    const sql=async(parts,...values)=>{
      const query=parts.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
      return (await db.query(query,values)).rows;
    };
    const crypto=loadModule('lib/account/email/crypto.ts',{'node:crypto':nodeCrypto},
      {process:{env:{EMAIL_PROTECTION_SECRET:'isolated-fixture-secret-over-thirty-two-characters'}}});
    const config=loadModule('lib/account/config.ts');
    const policy=loadModule('lib/account/email/policy.ts',{'../store':{accountSql:sql},'./crypto':crypto,'../config':config});
    const challenges=loadModule('lib/account/email/challenges.ts',{
      '../store':{accountSql:sql},'../config':config,'./crypto':crypto,'./policy':policy,
      './delivery':{resendClient:()=>({})},'./templates':{verificationMail:(email,code)=>({email,code})},
    });
    const count=async()=>Number((await db.query('SELECT count(*)::int AS count FROM b1_email_outbox')).rows[0].count);
    const latestCode=async()=>crypto.unseal((await db.query('SELECT payload FROM b1_email_outbox ORDER BY created_at DESC,id DESC LIMIT 1')).rows[0].payload).code;
    const first=await challenges.createChallenge('fixture@example.invalid','signup',new Headers());
    assert.equal(first.accepted,true);assert.equal(first.sendLimited,false);assert.equal(first.seconds,60);
    const firstCode=await latestCode();
    await assert.rejects(challenges.consumeChallenge(first.token,'signup'),/Verify this email/);
    const tooSoon=await challenges.resendChallenge(first.token);
    assert.ok(tooSoon.seconds>0&&tooSoon.seconds<=60);assert.equal(await count(),1);
    await db.exec("UPDATE b1_email_ledgers SET last_at=now()-interval '61 seconds'");
    await Promise.all([challenges.resendChallenge(first.token),challenges.resendChallenge(first.token)]);
    assert.equal(await count(),2);
    const ledger=(await db.query('SELECT sends,blocked_until>now() AS blocked,extract(epoch FROM blocked_until-now()) AS remaining FROM b1_email_ledgers')).rows[0];
    assert.equal(ledger.sends,2);assert.equal(ledger.blocked,true);assert.ok(Number(ledger.remaining)>86390);
    const denied=await challenges.resendChallenge(first.token);
    assert.equal(denied.sendLimited,true);assert.match(denied.message,/Use a different email/);assert.equal(await count(),2);
    const code=await latestCode();
    if(firstCode!==code)await assert.rejects(challenges.verifyChallenge(first.token,firstCode),/incorrect/);
    const wrong=code==='000000'?'111111':'000000';
    await assert.rejects(challenges.verifyChallenge(first.token,wrong),/incorrect/);
    await assert.rejects(challenges.consumeChallenge(first.token,'signup'),/Verify this email/);
    assert.equal(await challenges.verifyChallenge(first.token,code),true);
    assert.equal((await challenges.consumeChallenge(first.token,'signup')).email,'fixture@example.invalid');
    await assert.rejects(challenges.consumeChallenge(first.token,'signup'),/Verify this email/);
    const blocked=await challenges.createChallenge('fixture@example.invalid','signup',new Headers());
    assert.equal(blocked.codeAvailable,false);assert.equal(blocked.sendLimited,true);assert.equal(await count(),2);
    const other=await challenges.createChallenge('other@example.invalid','signup',new Headers());
    assert.equal(other.accepted,true);assert.equal(other.sendLimited,false);assert.equal(await count(),3);
    await db.query("UPDATE b1_email_ledgers SET first_at=now()-interval '25 hours',last_at=now()-interval '25 hours',blocked_until=now()-interval '1 second' WHERE recipient_key=$1",[crypto.protectedKey('fixture@example.invalid')]);
    const nextDay=await challenges.createChallenge('fixture@example.invalid','signup',new Headers());
    assert.equal(nextDay.accepted,true);assert.equal(nextDay.sendLimited,false);
  } finally { await db.close(); }
});

function proofFixture(requestValue,resendValue) {
  const harness=hookHarness();let verified=0,resends=0;
  const Component=loadModule('app/components/shared/account/EmailProofForm.tsx',{
    react:harness.react,'react/jsx-runtime':jsxRuntime,
    '@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},
    '@/app/components/ui/password-input':{PasswordInput:'Password'},'@/lib/actions/identity.actions':{},
    '@/lib/account/email/signup-client':{
      beginSignupProof:async()=>({ok:true,value:requestValue}),
      resendSignupProof:async()=>{resends++;return {ok:true,value:resendValue};},
      confirmSignupCode:async code=>code==='000123'?{ok:true,value:{verified:true}}:{ok:false,error:'Code is incorrect.'},
    },
  }).default;
  const render=()=>harness.render(()=>Component({purpose:'signup',initialEmail:'fixture@example.invalid',signupReady:true,signupAgreement:legalAgreement,onVerified:()=>{verified++;}}));
  const submit=()=>findNode(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
  return {render,submit,verified:()=>verified,resends:()=>resends};
}

test('an email limit without an owned code keeps the email editable instead of opening an unusable code form',async()=>{
  const f=proofFixture({message:'Email-code limit reached. Use a different email address.',seconds:0,sendLimited:true,codeAvailable:false});
  await f.submit();
  assert.equal(findNode(f.render(),n=>n.props.label==='Email').props.disabled,false);
  assert.equal(findNode(f.render(),n=>n.props.label==='Six-digit code'),undefined);
  assert.match(JSON.stringify(f.render()),/Use a different email/);
});

test('limited resends display a different-email action without a 24-hour countdown and keep correct-code completion available',async()=>{
  const f=proofFixture({message:'Code queued.',seconds:0}, {message:'A new code was queued.',seconds:60,sendLimited:true,blockedUntil:'2099-01-01T00:00:00Z'});
  await f.submit();
  await findNode(f.render(),n=>n.type==='Button'&&n.props.children==='Resend code').props.onClick();
  let tree=f.render();assert.equal(f.resends(),1);
  assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.children==='Resend code'),undefined);
  assert.doesNotMatch(JSON.stringify(tree),/Resend in|24 hours|24h/);
  assert.ok(findNode(tree,n=>n.type==='Button'&&n.props.children==='Use a different email'));
  findNode(tree,n=>n.props.label==='Six-digit code').props.onChange({target:{value:'111111'}});
  await f.submit();assert.equal(f.verified(),0);
  findNode(f.render(),n=>n.props.label==='Six-digit code').props.onChange({target:{value:'000123'}});
  await f.submit();assert.equal(f.verified(),1);
});

test('changing email after a limit clears only the proof and email, leaving signup details controlled by the parent',async()=>{
  const f=proofFixture({message:'Limit reached.',seconds:0,sendLimited:true,codeAvailable:true});
  await f.submit();
  await findNode(f.render(),n=>n.type==='Button'&&n.props.children==='Use a different email').props.onClick();
  const tree=f.render();assert.equal(findNode(tree,n=>n.props.label==='Email').props.value,'');
  assert.equal(findNode(tree,n=>n.props.label==='Six-digit code'),undefined);
  assert.ok(findNode(tree,n=>n.type==='Button'&&n.props.children==='Send verification code'));
});
