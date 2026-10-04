import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';
import {legalValidation, legalTypes} from './legal-fixture.mjs';
const native = createRequire(import.meta.url);
export const publicEnv = {LEGAL_OPERATOR_NAME:'Synthetic Operator', LEGAL_OPERATOR_FORM:'Individual (natural person)',
  LEGAL_OPERATOR_COUNTRY:'Synthetic country', LEGAL_OPERATOR_ADDRESS:'Synthetic fixture address',
  LEGAL_CONTACT_EMAIL:'fixture@example.invalid'};
export const publicContent = loadModule('lib/legal/public-content.ts', {
  '../account/config':loadModule('lib/account/config.ts'), './operator':loadModule('lib/legal/operator.ts'),
  './validation':legalValidation,
});
export function staticStore(env = publicEnv) {
  return loadModule('lib/legal/store.ts', {'./public-content':publicContent, './validation':legalValidation, './types':legalTypes}, {process:{env}});
}
export const signupRepository = accountSql => loadModule('lib/account/signup.ts', {'./store':{accountSql}});
export {native};
