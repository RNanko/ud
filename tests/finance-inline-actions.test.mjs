import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";

const entry = { id: "entry", date: "2026-10-05", amount: "12.34", type: "-", category: "Food", subcategory: null, comment: null, currency: "USD" };
const category = { name: "Food", type: "-" };
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(actions, initialEntries=[entry]) {
  const hooks = hookHarness();
  const effects = [];
  const react = { ...hooks.react, useEffect(fn, deps) {
    const slot = hooks.react.useRef({ deps: undefined, cleanup: undefined });
    if (!deps || !slot.current.deps || deps.some((value, index) => !Object.is(value, slot.current.deps[index]))) {
      slot.current.deps = deps;
      effects.push(() => { slot.current.cleanup?.(); slot.current.cleanup = fn(); });
    }
  } };
  const Client = loadModule("app/(main)/account/finance/FinanceClient.tsx", {
    react, "react/jsx-runtime": jsxRuntime, "next/link": "Link",
    "@radix-ui/react-dialog": {}, "lucide-react": {},
    "@/app/components/ui/button": { Button: "Button" },
    "@/app/components/ui/tabs": { Tabs: "Tabs", TabsContent: "TabsContent", TabsList: "TabsList", TabsTrigger: "TabsTrigger" },
    "@/lib/actions/finance.actions": actions,
    "@/lib/finance": loadModule("lib/finance.ts"),
    "@/lib/finance-playground": loadModule("lib/finance-playground.ts"),
    "@/hooks/use-finance-order": { useFinanceOrder: entries => ({ ordered: entries, saveOrder: () => true, orderEntries: entries => entries }) },
    "./FinanceViews": { FinanceCharts: "Charts", FinanceDashboard: "Dashboard", FinanceHistory: "History", FinancePlayground: "Playground" },
    "./FinanceViewTransition": "ViewTransition", "./FinanceSelect": "Select",
    "./FinanceEditor": { __esModule: true, default: "Editor", financeDialogClass: "" },
    "./HoldDeleteButton": "HoldDelete",
  }).default;
  const render = () => {
    const tree = hooks.render(() => Client({ initialRevision: 0, initialEntries, initialCategories: [category], userId: "fixture" }));
    while (effects.length) effects.shift()();
    return tree;
  };
  const history = () => findNode(render(), node => node.type === "History").props;
  const playground = () => findNode(render(), node => node.type === "Playground").props;
  const undo = () => findNode(render(), node => node.type === "Button" && node.props.children === "Undo");
  return { render, history, playground, undo };
}

test('Finance dashboard currency and month controls follow populated data and do not change entry defaults',()=>{
 const records=[{...entry,id:'usd',currency:'USD',date:'2024-01-05'}, {...entry,id:'eur',currency:'EUR',date:'2024-02-05'}];
 const state=fixture({},records);
 findNode(state.render(),n=>n.type==='Tabs').props.onValueChange('dashboard');
 let tree=state.render();
 assert.equal(findNode(tree,n=>n.type==='Select'&&n.props.label==='Finance period').props.value,'2024-01');
 assert.equal(findNode(tree,n=>n.type==='Dashboard').props.entries[0].id,'usd');
 findNode(tree,n=>n.type==='Select'&&n.props.label==='Dashboard currency').props.onValueChange('EUR');
 tree=state.render();
 assert.equal(findNode(tree,n=>n.type==='Dashboard').props.entries[0].id,'eur');
 assert.equal(findNode(tree,n=>n.type==='Select'&&n.props.label==='Finance period').props.value,'2024-02');
 assert.equal(findNode(tree,n=>n.type==='Dashboard').props.allEntries.length,1);
 assert.equal(findNode(tree,n=>n.type==='Charts').props.currency,'USD');
 findNode(tree,n=>n.type==='Tabs').props.onValueChange('history');
 tree=state.render();
 assert.equal(findNode(tree,n=>n.type==='Select'&&n.props.label==='Finance period').props.value,'2024-02');
 assert.equal(findNode(tree,n=>n.type==='History').props.entries[0].id,'eur');
});

test("Finance history deletion retains a lost-response envelope and updates charts only after confirmation", async () => {
  const writes = []; let fail = true;
  const state = fixture({ commitFinance: async command => {
    writes.push(plain(command)); if (fail) throw Error("Lost response");
    return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:1,entries:[],categories:[category]}};
  } });
  await assert.rejects(state.history().onDelete(entry), /confirm/);
  assert.equal(state.history().entries.length,1);
  assert.equal(findNode(state.render(),node=>node.type==='Charts').props.entries.length,1);
  fail=false;findNode(state.render(),node=>node.type==='MoneyRecovery').props.onRetry();await tick();
  assert.deepEqual(writes[1],writes[0]);
  assert.equal(state.history().entries.length,0);
  assert.equal(findNode(state.render(),node=>node.type==='Charts').props.entries.length,0);
});

test("Finance category removal keeps transactions and exposes inline restoration", async () => {
  let restored = 0;
  const state = fixture({
    commitFinance: async command => { if(!command.data.hidden) restored++; return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:command.revision+1,entries:[entry],categories:[{...category,hidden:command.data.hidden}]}}; },
  });
  await state.playground().onRemoveCategory(category);
  await tick();
  assert.equal(state.history().entries.length, 1);
  assert.ok(state.undo());
  state.undo().props.onClick(); await tick();
  assert.equal(restored, 1);
  assert.equal(state.undo(), undefined);
  assert.deepEqual(plain(state.history().entries[0]), entry);
});

test("Finance quick-add returns immediately, keeps its optimistic amount and retries one envelope after a lost response", async () => {
  const commands=[];let fail=true;
  const state=fixture({commitFinance:async command=>{commands.push(plain(command));if(fail)throw Error('Lost response');return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:1,entries:[entry,{...command.data.entry,id:command.data.id}],categories:[category]}};}});
  const draft={...entry,subcategory:'Draft detail',comment:'Draft note'};delete draft.id;
  await state.playground().onSave(null,draft);await tick();
  assert.equal(state.playground().busy,true);assert.equal(state.history().entries.length,2);
  await assert.rejects(state.playground().onSave(null,{...draft,amount:'55.00'}),/pending/);assert.equal(commands.length,1);
  fail=false;findNode(state.render(),node=>node.type==='BackgroundSaveStatus').props.onRetry();await tick();
  assert.deepEqual(commands[1],commands[0]);assert.equal(state.playground().busy,false);assert.equal(state.history().entries.length,2);
  assert.equal(state.playground().initialAmount,undefined);
  await state.playground().onSave(null,draft);assert.notEqual(commands[2].data.id,commands[0].data.id);assert.notEqual(commands[2].operationId,commands[0].operationId);
});

test('successive Finance amount drops remain usable and preserve newer optimistic entries while acknowledgements arrive', async () => {
  const requests=[];
  const state=fixture({commitFinance:command=>new Promise(resolve=>requests.push({command:plain(command),resolve}))});
  const draft={...entry,subcategory:'',comment:''};delete draft.id;
  await state.playground().onSave(null,draft);
  assert.equal(state.playground().busy,false);
  await state.playground().onSave(null,{...draft,amount:'55.00'});
  assert.equal(requests.length,1);
  assert.equal(state.history().entries.length,3);
  const first={...requests[0].command.data.entry,id:requests[0].command.data.id};
  requests[0].resolve({success:true,acknowledgedOperationId:requests[0].command.operationId,snapshot:{revision:1,entries:[entry,first],categories:[category]}});await tick();
  assert.equal(requests[1].command.revision,1);
  assert.equal(state.history().entries.length,3);
  const second={...requests[1].command.data.entry,id:requests[1].command.data.id};
  requests[1].resolve({success:true,acknowledgedOperationId:requests[1].command.operationId,snapshot:{revision:2,entries:[entry,first,second],categories:[category]}});await tick();
  state.history().onEdit(entry);
  const editor=findNode(state.render(),node=>node.type==='Editor').props;
  const normalSave=editor.onSave(entry.id,{...draft,amount:'9.00'});
  assert.equal(requests[2].command.revision,2);
  requests[2].resolve({success:true,acknowledgedOperationId:requests[2].command.operationId,snapshot:{revision:3,entries:[{...entry,amount:'9.00'},first,second],categories:[category]}});await normalSave;
});

test("Finance conflict keeps the editor draft, shows latest values, and only explicit review retries with a new revision",async()=>{
  const commands=[];const latest={...entry,amount:'99.00',comment:'Other device'};
  const state=fixture({commitFinance:async command=>{commands.push(plain(command));return commands.length===1?{success:false,status:'conflict',message:'Review newer changes',snapshot:{revision:8,entries:[latest],categories:[category]}}:{success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:9,entries:[{id:entry.id,...command.data.entry}],categories:[category]}};}});
  state.history().onEdit(entry);let editor=findNode(state.render(),node=>node.type==='Editor').props;
  const draft={...entry,amount:'15.00',subcategory:'My detail',comment:'My unsaved note'};delete draft.id;
  await assert.rejects(editor.onSave(entry.id,draft),/Review/);
  editor=findNode(state.render(),node=>node.type==='Editor').props;
  assert.equal(editor.entry.amount,'12.34');assert.equal(editor.blocked,true);assert.equal(state.history().entries[0].amount,'99.00');
  assert.match(editor.recovery.props.draft,/15.00.*My detail.*My unsaved note/);assert.match(editor.recovery.props.latest,/99.00.*Other device/);
  editor.onClose();assert.ok(findNode(state.render(),node=>node.type==='Editor'));assert.equal(commands.length,1);
  editor.recovery.props.onRetry();await tick();
  assert.equal(commands[1].revision,8);assert.notEqual(commands[1].operationId,commands[0].operationId);assert.deepEqual(commands[1].data,commands[0].data);
  assert.equal(state.history().entries[0].amount,'15.00');assert.equal(findNode(state.render(),node=>node.type==='Editor'),undefined);
});

test("Finance deleted-record conflict offers discard without an edit retry and retains unrelated quick-entry state",async()=>{
  const state=fixture({commitFinance:async()=>({success:false,status:'conflict',message:'Deleted elsewhere',snapshot:{revision:4,entries:[],categories:[category]}})});
  state.history().onEdit(entry);const editor=findNode(state.render(),node=>node.type==='Editor').props;
  await assert.rejects(editor.onSave(entry.id,{...entry,subcategory:'',comment:'Retained'}),/Deleted/);
  const recovery=findNode(state.render(),node=>node.type==='Editor').props.recovery;
  assert.equal(recovery.props.canRetry,false);assert.match(recovery.props.latest,/deleted/);assert.equal(state.playground().initialAmount,undefined);
  recovery.props.onDiscard();assert.equal(findNode(state.render(),node=>node.type==='Editor'),undefined);assert.equal(state.playground().busy,false);assert.equal(state.playground().initialAmount,undefined);
});

test("category recovery is available inside the category dialog and preserves quick-entry input",async()=>{
  let first=true;const state=fixture({commitFinance:async command=>{if(first){first=false;throw Error('Lost response');}return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:1,entries:[entry],categories:[category]}};}});
  await assert.rejects(state.playground().onCreateCategory(category),/confirm/);assert.ok(state.playground().recovery);assert.equal(state.playground().categoryVersion,0);
  state.playground().recovery.props.onRetry();await tick();assert.equal(state.playground().categoryVersion,1);assert.equal(state.playground().initialAmount,undefined);
});

test("History currency edit retries the same envelope and updates the confirmed history and charts",async()=>{
  const commands=[];let fail=true;
  const state=fixture({commitFinance:async command=>{
    commands.push(plain(command));if(fail)throw Error('Lost response');
    return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:1,entries:[{id:entry.id,...command.data.entry}],categories:[category]}};
  }});
  state.history().onEdit(entry);
  const editor=findNode(state.render(),node=>node.type==='Editor').props;
  await assert.rejects(editor.onSave(entry.id,{...entry,subcategory:'',comment:'',currency:'EUR'}),/confirm/);
  assert.equal(commands[0].data.changeCurrency,true);assert.equal(commands[0].data.entry.currency,'EUR');
  assert.equal(commands[0].data.entry.amount,'12.34');assert.equal(state.history().entries[0].currency,'USD');
  fail=false;findNode(state.render(),node=>node.type==='Editor').props.recovery.props.onRetry();await tick();
  assert.deepEqual(commands[1],commands[0]);assert.equal(state.history().entries[0].currency,'EUR');
  assert.equal(findNode(state.render(),node=>node.type==='Charts').props.entries[0].currency,'EUR');
});
