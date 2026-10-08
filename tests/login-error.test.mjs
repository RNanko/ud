import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {signInErrorMessage}=loadModule('lib/account/login-error.ts');

test('server and connection failures never blame the supplied password or expose server diagnostics',()=>{
  for(const status of [500,502,503]) {
    const message=signInErrorMessage({status,code:'INVALID_EMAIL_OR_PASSWORD',message:'private server details'});
    assert.match(message,/temporarily unavailable/);
    assert.doesNotMatch(message,/incorrect|private server details/);
  }
  for(const error of [null,undefined,{status:0},{status:401,code:'FAILED_TO_CREATE_SESSION'}])assert.doesNotMatch(signInErrorMessage(error),/password is incorrect/);
});

test('credential, verification and rate-limit failures provide distinct next steps',()=>{
  assert.match(signInErrorMessage({status:401,code:'INVALID_EMAIL_OR_PASSWORD'}),/Forgot password/);
  assert.match(signInErrorMessage({status:403,code:'EMAIL_NOT_VERIFIED'}),/Verify your email/);
  assert.match(signInErrorMessage({status:429}),/wait and try again/);
});
