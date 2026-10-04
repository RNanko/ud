import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';
const require=createRequire(import.meta.url);

function fixture({breached=false,unavailable=false}={}) {
 const requests=[];
 const hash=require('node:crypto').createHash('sha1').update('m!9Qv#7L').digest('hex').toUpperCase();
 const policy=loadModule('lib/account/password.ts',{
  'node:crypto':require('node:crypto'),
  '@zxcvbn-ts/core':require('@zxcvbn-ts/core'),
  '@zxcvbn-ts/language-common':require('@zxcvbn-ts/language-common'),
  '@zxcvbn-ts/language-en':require('@zxcvbn-ts/language-en'),
 },{fetch:async(url,options)=>{requests.push({url,options});if(unavailable)throw Error('Offline');return new Response(breached?`${hash.slice(5)}:12`:'');}});
 return {...policy,requests,hash};
}

test('eight-character passwords are accepted and shorter/oversized values are rejected before network checks',async()=>{
 const f=fixture();
 for(const password of ['m!9Qv#7', 'x'.repeat(129), null])await assert.rejects(f.validateNewPassword(password),/8–128/);
 assert.equal(f.requests.length,0);
 await f.validateNewPassword('m!9Qv#7L');
 assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].url,`https://api.pwnedpasswords.com/range/${f.hash.slice(0,5)}`);
 assert.equal(f.requests[0].options.headers['Add-Padding'],'true');
});

test('the eight-character minimum retains predictable-password, known-breach and safety-check outage protection',async()=>{
 const weak=fixture();await assert.rejects(weak.validateNewPassword('password'),/less predictable/);assert.equal(weak.requests.length,0);
 await assert.rejects(fixture({breached:true}).validateNewPassword('m!9Qv#7L'),/known breaches/);
 await assert.rejects(fixture({unavailable:true}).validateNewPassword('m!9Qv#7L'),/temporarily unavailable/);
});
