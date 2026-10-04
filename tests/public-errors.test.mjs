import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

test('account action results never serialize unexpected provider/database errors',async()=>{
 const service=loadModule('lib/account/result.ts');
 for(const value of [new Error('DB query includes PRIVATE_FIXTURE'),new Error('Provider token PRIVATE_FIXTURE'),{message:'PRIVATE_FIXTURE'}]){
  const result=await service.actionResult(async()=>{throw value;});assert.equal(result.ok,false);assert.doesNotMatch(result.error,/PRIVATE_FIXTURE|DB query|Provider token/);assert.match(result.error,/retry/i);
 }
});

test('legacy form errors do not reflect database messages or malformed objects',async()=>{
 const service=loadModule('lib/utils.ts',{clsx:{clsx:()=>''},'tailwind-merge':{twMerge:()=>''}});
 for(const value of [new Error('PRIVATE_FIXTURE'),{name:'ZodError',issues:[{message:'PRIVATE_FIXTURE'}]},null])assert.doesNotMatch(await service.formatError(value),/PRIVATE_FIXTURE/);
});

test('deliberate public messages remain useful but an untrusted message cannot imitate them',async()=>{
 const errors=loadModule('lib/account/errors.ts'),service=loadModule('lib/account/result.ts',{'./errors':errors});
 assert.equal((await service.actionResult(async()=>{throw new errors.PublicError('Review the updated documents and agree again.');})).error,'Review the updated documents and agree again.');
 const forged=new Error('PRIVATE_FIXTURE');forged.name='PublicError';assert.doesNotMatch((await service.actionResult(async()=>{throw forged;})).error,/PRIVATE_FIXTURE/);
 const {z}=await import('zod');const invalid=await service.actionResult(async()=>z.object({email:z.email()}).parse({email:'invalid'}));assert.equal(invalid.error,'Please enter a valid email address.');
});
