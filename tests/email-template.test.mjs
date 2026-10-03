import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
const email=loadModule('lib/account/email/templates.ts');

test('the shared app email escapes user content and refuses unsafe action URLs',()=>{
  const mail=email.mailTemplate('preview@example.invalid','<script>alert(1)</script>',['<img src=x onerror=alert(1)>'],{href:'https://b1-way.pl/account?a=1&b=2',label:'<Open>'},{eyebrow:'<Hello>',footer:'<Footer>'});
  assert.equal(mail.html.includes('<script>'),false);
  assert.equal(mail.html.includes('<img src=x'),false);
  assert.ok(mail.html.includes('&lt;Open&gt;'));
  assert.ok(mail.html.includes('a=1&amp;b=2'));
  assert.throws(()=>email.mailTemplate('preview@example.invalid','Title',[],{href:'javascript:alert(1)',label:'Open'}),/HTTP/);
  assert.throws(()=>email.mailTemplate('preview@example.invalid','Title',[],undefined,{preferencesHref:'data:text/html,hi'}),/HTTP/);
});

test('verification keeps leading zeros in HTML and plain text without exposing the code in a preview',()=>{
  const mail=email.verificationMail('preview@example.invalid','000123');
  assert.ok(mail.text.includes('Your verification code is 000123.'));
  assert.ok(mail.html.includes('>000123</p>'));
  assert.ok(mail.html.includes('10 minutes'));
  const preview=mail.html.match(/<div style="display:none[^>]*>(.*?)<\/div>/s)[1];
  assert.equal(preview.includes('000123'),false);
  assert.throws(()=>email.verificationMail('preview@example.invalid','<123>'),/six digits/);
});

test('requested test email is honest, small, responsive and contains no tracking or remote image dependencies',()=>{
  const mail=email.testMail('preview@example.invalid','http://localhost:3000');
  assert.ok(mail.html.includes('max-width:600px'));
  assert.ok(Buffer.byteLength(mail.html)<10000);
  assert.equal(/<img|<script|<iframe|@import/i.test(mail.html),false);
  assert.ok(mail.html.includes('href="http://localhost:3000/account"'));
  assert.ok(mail.text.includes('does not opt you into email reminders'));
  assert.ok(mail.html.includes(email.emailTheme.blue));
  assert.ok(mail.html.includes(email.emailTheme.orange));
});
