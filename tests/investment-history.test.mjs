import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,hookHarness,jsxRuntime,findNode} from './helpers.mjs';

test('position history paginates safely and offers restoration rather than editing an archived record',async()=>{
  const lib=loadModule('lib/investments.ts'),hooks=hookHarness(),restored=[],edited=[],removed=[];
  const History=loadModule('app/(main)/account/investments/InvestmentHistory.tsx',{
    react:hooks.react,'react/jsx-runtime':jsxRuntime,'lucide-react':{},'@/app/components/ui/button':{Button:'Button'},
    '@/lib/investments':lib,'../finance/HoldDeleteButton':'HoldDelete',
  }).default;
  let rows=Array.from({length:10},(_,i)=>lib.valuePosition({id:`row-${i}`,kind:'other',assetId:null,symbol:`STOCK${i}`,name:'Stock',buyPrice:'10',quantity:'2',boughtOn:'2026-01-01',currency:'USD',archived:i===9,manualPrice:'15',manualPriceAt:null},{}));
  const render=()=>hooks.render(()=>History({rows,busy:false,filtered:false,onEdit:p=>edited.push(p.id),onRemove:async p=>removed.push(p.id),onRestore:async p=>restored.push(p.id),onReset(){}}));
  const articles=tree=>{const result=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type==='article')result.push(n);for(const c of [n.props?.children].flat(Infinity))walk(c);}walk(tree);return result;};
  assert.equal(articles(render()).length,8);
  assert.equal(findNode(render(),n=>n.props?.['aria-label']==='Previous investment history page').props.disabled,true);
  findNode(render(),n=>n.props?.['aria-label']==='Next investment history page').props.onClick();
  assert.equal(articles(render()).length,2);
  assert.equal(findNode(render(),n=>n.props?.['aria-label']==='Edit STOCK9 position'),undefined);
  await findNode(render(),n=>n.props?.['aria-label']==='Restore STOCK9 position').props.onClick();assert.deepEqual(restored,['row-9']);
  findNode(render(),n=>n.props?.['aria-label']==='Edit STOCK8 position').props.onClick();assert.deepEqual(edited,['row-8']);
  const holdDelete=findNode(render(),n=>n.type==='HoldDelete'&&n.props.label==='STOCK8 position');
  assert.equal(holdDelete.props.compact,true);
  assert.equal(holdDelete.props.disabled,false);
  assert.deepEqual(removed,[]);
  assert.equal(findNode(render(),n=>n.type==='Confirm'),undefined);
  await holdDelete.props.onConfirm();assert.deepEqual(removed,['row-8']);
  rows=rows.slice(0,1);assert.equal(articles(render()).length,1);assert.equal(findNode(render(),n=>n.props?.['aria-label']==='Next investment history page').props.disabled,true);
});
