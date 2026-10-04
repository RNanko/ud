import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, jsxRuntime, findNode, plain } from './helpers.mjs';

test('private export includes the owner’s inbox state without queue, provider, or other-product data', async () => {
  const calls = [], preferences = loadModule('lib/account/preferences.ts');
  const sql = async (parts, ...values) => {
    const query = parts.join('?'); calls.push({query, values});
    if (query.includes('FROM b1_notifications')) {
      assert.ok(query.includes('product=')); assert.deepEqual(plain(values), ['alice', 'b1-way-personal']);
      assert.doesNotMatch(query, /SELECT \*/);
      return [{id:'owned-message', title:'My saved workout', body:'Completed', read_at:null, archived_at:null}];
    }
    if (query.includes('FROM "user"')) return [{id:'alice', name:'Synthetic user', email:'alice@example.invalid'}];
    return [];
  };
  sql.query = async (query, values) => { calls.push({query, values}); assert.deepEqual(plain(values), ['alice']); return []; };
  const actions = loadModule('lib/actions/privacy.actions.ts', {
    'next/headers':{headers:async()=>new Headers()}, '../auth':{auth:{}},
    '../session':{requireUserId:async()=> 'alice'},
    '../account/store':{accountSql:sql, accountSettings:async()=>({preferences:preferences.defaultPreferences}), membershipFor:async()=>null},
    '../account/privacy':{}, '../legal/store':{legalAccountHistory:async owner=>{assert.equal(owner,'alice');return []; }},
    '../account/result':loadModule('lib/account/result.ts'),
  });
  const result = await actions.exportAccountData();
  assert.equal(result.ok,true);
  assert.equal(result.value.data.notifications?.[0]?.id,'owned-message');
  assert.equal(result.value.account.id,'alice');
  assert.equal(calls.some(x=>x.values.includes('bob')),false);
  assert.doesNotMatch(JSON.stringify(result.value),/lease_id|customer_id|password_hash|dedup_key/);
});

test('finance chart supplies labeled monthly amounts outside the graphical plot', () => {
  const component = props=>props;
  const chart = loadModule('app/(main)/account/finance/chart/chart.tsx', {
    'react/jsx-runtime':jsxRuntime,
    recharts:Object.fromEntries(['Bar','BarChart','CartesianGrid','ReferenceLine','YAxis','XAxis','LabelList','Legend'].map(x=>[x,component])),
    '@/app/components/ui/card':Object.fromEntries(['Card','CardContent','CardHeader','CardTitle'].map(x=>[x,component])),
    '@/app/components/ui/chart':Object.fromEntries(['ChartContainer','ChartTooltip','ChartTooltipContent'].map(x=>[x,component])),
    '@/app/components/ui/button':{Button:component}, 'next/link':{default:component},'lucide-react':{ArrowBigLeft:component},
    '@/hooks/use-account-format':{useAccountFormat:()=>({formatAmount:value=>Number(value).toFixed(2)})},
  }).default;
  const tree = chart({chartData:[{month:'2025-10',income:3400,outcome:-900},{month:'2026-10',income:500,outcome:-250}],currency:'USD'});
  const table = findNode(tree,node=>node.type==='table'); assert.ok(table,'A non-graphical table is available');
  const serialized = JSON.stringify(plain(table));
  for(const value of ['USD','Revenue','Spending','2025-10','2026-10','3400.00','900.00','250.00']) assert.ok(serialized.includes(value),value);
  assert.equal(serialized.includes('-900.00'),false);
});

test('chart currency label shares its data snapshot when account preferences change between reads',async()=>{
  let reads=0, filteredCurrency;
  const accountSettings=async()=>({preferences:{financeDefaultCurrency:++reads===1?'PLN':'USD'}});
  const getChartIncomeOutcomeSnapshot=async()=>{const {preferences}=await accountSettings();filteredCurrency=preferences.financeDefaultCurrency;return {currency:filteredCurrency,data:[{month:'2026-10',income:10,outcome:-5}]};};
  const page=loadModule('app/(main)/account/finance/chart/page.tsx',{
    'react/jsx-runtime':jsxRuntime,react:{Suspense:'Suspense'},'./chart':{__esModule:true,default:'Chart'},
    '@/app/components/shared/loader':{default:'Loader'},'@/lib/auth':{auth:{api:{getSession:async()=>({session:{userId:'alice'}})}}},
    'next/headers':{headers:async()=>new Headers()},'@/lib/session':{requireUserId:async()=> 'alice'},
    '@/lib/account/store':{accountSettings},'@/lib/actions/finance.actions':{getChartIncomeOutcomeSnapshot,getChartIncomeOutcomeData:async()=> (await getChartIncomeOutcomeSnapshot()).data},
  }).default;
  const boundary=page().props.children, rendered=await boundary.type();
  const chart=findNode(rendered,node=>node.type==='Chart');
  assert.equal(chart.props.currency,filteredCurrency,'Displayed currency matches the actual query filter');
  assert.equal(reads,1,'No second preference read can relabel the totals');
});
