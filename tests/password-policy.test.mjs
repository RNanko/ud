import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
test('password rules accept customer choices of eight or more characters without strength or external breach checks',async()=>{
 const policy=loadModule('lib/account/password.ts',{}, {fetch(){throw Error('No external password check is allowed');}});
 for(const password of ['password','12345678','m!9Qv#7L','aaaaaaaB','x'.repeat(127)+'y']) await policy.validateNewPassword(password);
 for(const password of ['1234567','x'.repeat(128)+'y',null]) await assert.rejects(policy.validateNewPassword(password),/8–128/);
});

test('browser and server reject passwords made from just one repeated character, including spaces and emoji',async()=>{
 const {passwordValidationError}=loadModule('lib/account/password-policy.ts');
 const {validateNewPassword}=loadModule('lib/account/password.ts');
 for(const password of ['aaaaaaaa','11111111',' '.repeat(8),'😀'.repeat(8)]) {
  assert.match(passwordValidationError(password),/two different characters/);
  await assert.rejects(validateNewPassword(password),/two different characters/);
 }
 assert.equal(passwordValidationError('aaaaaaaA'),null);
 assert.equal(passwordValidationError('😀😀😀😁'),null);
});
