import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,plain,hookHarness,jsxRuntime,findNode} from './helpers.mjs';

const decimal=loadModule('lib/account/decimal.ts');
const charts=loadModule('lib/money/charts.ts',{'../account/decimal':decimal});
const base={id:'one',date:'2026-01-01',category:'Food',detail:'Lunch',series:'Spending',amount:'0.10',currency:'EUR'};
const defaults={from:'',to:'',category:'',detail:'',series:'',currency:'EUR',minimum:'',maximum:''};
const records=[base,{...base,id:'two',date:'2026-03-31',amount:'0.20'}, {...base,id:'three',category:'Salary',detail:'Monthly salary',series:'Revenue',amount:'3000.00'}, {...base,id:'usd',amount:'9000.00',currency:'USD'}, {...base,id:'unknown',currency:null}, {...base,id:'numbers',currency:'NONE'}];

test('chart filters combine inclusive dates, category, details, type, exact amount bounds and one currency',()=>{
 assert.deepEqual(plain(charts.filterMoneyChart(records,{...defaults,from:'2026-01-01',to:'2026-03-31',category:'Food',detail:'lUnCh',series:'Spending',minimum:'0.1',maximum:'0.20'})).map(row=>row.id),['one','two']);
 assert.deepEqual(plain(charts.filterMoneyChart(records,{...defaults,from:'2026-01-02'})).map(row=>row.id),['two']);
 for(const currency of ['USD','unassigned','NONE'])assert.equal(charts.filterMoneyChart(records,{...defaults,currency}).length,1);
 for(const filters of [{minimum:'0.21',maximum:'0.20'},{minimum:'-1'},{maximum:'NaN'},{minimum:'1,00'},{from:'2026-03-01',to:'2026-02-01'}]){
  assert.ok(charts.chartFilterError({...defaults,...filters}));
  assert.equal(charts.filterMoneyChart(records,{...defaults,...filters}).length,0);
 }
});

test('chart aggregation preserves exact decimals and refuses mixed units',()=>{
 const data=charts.buildMoneyChart(records.slice(0,2),'category','largest');
 assert.equal(data.total,0.3);assert.equal(data.points[0].exact,'0.300000000000000000000000');
 assert.equal(data.points[0].series0,0.3);
 const tiny=charts.buildMoneyChart([{...base,amount:'0.000000000000000000000001'}],'category','largest');
 assert.equal(tiny.points[0].exact,'0.000000000000000000000001');
 assert.throws(()=>charts.buildMoneyChart(records,'category','largest'),/currency/);
 assert.deepEqual(plain(charts.buildMoneyChart([],'category','largest').points),[]);
});

test('multi-month charts fill empty months with zero and keep chronology despite amount ordering',()=>{
 const data=charts.buildMoneyChart(records.slice(0,2),'month','largest','2025-12-01','2026-04-30');
 assert.deepEqual(plain(data.points.map(point=>[point.key,point.total])),[['2025-12',0],['2026-01',0.1],['2026-02',0],['2026-03',0.2],['2026-04',0]]);
 assert.equal(charts.chartPeriod(records.slice(0,2)).multipleMonths,true);
 assert.equal(charts.chartPeriod(records,'2026-01-01','2026-01-31').multipleMonths,false);
 assert.equal(charts.chartPeriod([],'2026-01-01','2026-03-31').multipleMonths,true);
 assert.deepEqual(plain(charts.buildMoneyChart(records.slice(0,3),'category','smallest').points.map(point=>point.label)),['Food','Salary']);
});

test('shared explorer enables monthly lines for date ranges and falls back safely after narrowing them',()=>{
 const hooks=hookHarness();
 const Explorer=loadModule('app/components/shared/charts/MoneyChartExplorer.tsx',{
  react:hooks.react,'react/jsx-runtime':jsxRuntime,'lucide-react':{},
  '@/app/components/ui/button':{Button:'Button'},'@/app/components/ui/input':{Input:'Input'},
  '@/lib/money/charts':charts,'@/app/(main)/account/finance/FinanceSelect':'Select',
  './ChartDatePicker':'DatePicker','./MoneyChart':'Chart',
 }).default;
 const render=()=>hooks.render(()=>Explorer({title:'Charts',records:records.slice(0,3),initialCurrency:'EUR'}));
 const button=label=>findNode(render(),node=>node.type==='Button'&&node.props.title===label)?.props;
 const date=label=>findNode(render(),node=>node.type==='DatePicker'&&node.props.label===label).props;
 button('Line').onClick();
 assert.equal(findNode(render(),node=>node.type==='Chart').props.type,'line');
 assert.equal(findNode(render(),node=>node.type==='Select'&&node.props.label==='Chart order').props.disabled,true);
 date('Chart from').onChange('2026-01-01');date('Chart through').onChange('2026-01-31');
 assert.equal(findNode(render(),node=>node.type==='Chart').props.type,'vertical');
 assert.equal(findNode(render(),node=>node.type==='Button'&&node.props.title==='Choose a period spanning multiple months').props.disabled,true);
 findNode(render(),node=>node.type==='Input'&&node.props['aria-label']==='Chart details').props.onChange({target:{value:'NO MATCH'}});
 assert.equal(findNode(render(),node=>node.type==='Chart'),undefined);
});

test('investment chart uses exact current value, includes zero, and excludes unpriced or unsupported positions',()=>{
 const Adapter=loadModule('app/(main)/account/investments/InvestmentCharts.tsx',{'react/jsx-runtime':jsxRuntime,'lucide-react':new Proxy({}, {get:(_,key)=>String(key)}),'@/app/components/ui/button':{Button:'Button'},'@/lib/account/decimal':decimal,'@/app/components/shared/charts/MoneyChartExplorer':'Explorer'}).default;
 const position={id:'asset',symbol:'BTC',name:'Bitcoin',kind:'crypto',boughtOn:'2026-01-02'};
 const tree=Adapter({rows:[{supported:true,position,costUnits:'300000000000000000000000',valueUnits:'900000000000000000000000'}, {supported:true,position:{...position,id:'zero'},valueUnits:'0'}, {supported:true,position:{...position,id:'missing'},valueUnits:null}, {supported:false,position:{...position,id:'legacy'},valueUnits:null}],refreshing:true,disabled:false,onRefresh:()=>{},updatedAt:'Oct 10',error:'',warnings:[]});
 assert.equal(tree.props.records.length,2);assert.equal(tree.props.records[0].amount,'0.900000000000000000000000');assert.equal(tree.props.records[1].amount,'0.000000000000000000000000');
 assert.equal(tree.props.records[0].date,'2026-01-02');assert.match(tree.props.description,/not historical market prices/);
 assert.equal(tree.props.totalLabel,'Current value');
 const refresh=tree.props.headerActions;assert.equal(refresh.props.disabled,true);assert.equal(refresh.props['aria-busy'],true);
 assert.ok(findNode(refresh,node=>node.type==='LoaderCircle'));assert.equal(findNode(tree,node=>node.type==='Loader'),undefined);
 assert.ok(findNode(tree,node=>node.props?.children?.includes?.(' awaiting a price and excluded from the chart.')));
});
