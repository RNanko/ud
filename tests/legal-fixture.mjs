import { createRequire } from 'node:module';
import { loadModule } from './helpers.mjs';
const native=createRequire(import.meta.url);
export const legalValidation=loadModule('lib/legal/validation.ts',{'node:crypto':native('node:crypto')});
export const legalTypes=loadModule('lib/legal/types.ts');
export const legalBundle={product:'b1-way-personal',locale:'en',statementVersion:'registration-1',statement:legalTypes.agreementStatement.text,purchaseReady:true,terms:{id:'b1-way-personal:terms:en:fixture-1',version:'fixture-1',hash:'terms-fixture',href:'/terms/fixture-1'},privacy:{id:'b1-way-personal:privacy:en:fixture-1',version:'fixture-1',hash:'privacy-fixture',href:'/privacy/fixture-1'}};
export const legalAgreement=legalTypes.agreementFor(legalBundle);
export const legalReview={decision:'approved',reviewer:'Isolated test fixture; not actual approval',reviewedAt:'2026-10-03T00:00:00Z',changeSummary:'Test fixture',reacceptance:'none',purchaseReady:true,checks:Object.fromEntries(legalValidation.reviewKeys.map(key=>[key,true]))};
