import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadModule} from './helpers.mjs';
test('isolated QA disables public quote fetches for both web and mobile, with no fabricated price',async()=>{
 let calls=0;const market=loadModule('lib/investment-market.ts',{'./data/crypto-catalog.json':JSON.parse(readFileSync('lib/data/crypto-catalog.json')),'./investments':loadModule('lib/investments.ts')},{process:{env:{MANFORTH_MOBILE_QA_LOCAL:'true'}},fetch:async()=>{calls++;throw Error('Unexpected provider request');}});
 const result=await market.investmentMarket([{id:'qa',kind:'other',assetId:null,symbol:'TEST',name:'Synthetic',buyPrice:'1',quantity:'1',boughtOn:'2026-10-04',manualPrice:null,manualPriceAt:null}]);assert.equal(Object.keys(result.quotes).length,0);assert.equal(result.catalogLive,false);assert.ok(result.warnings.some(w=>w.includes('disabled')));await assert.rejects(()=>market.getCryptoMarket(),/disabled/);assert.equal(calls,0);
});
