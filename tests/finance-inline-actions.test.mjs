import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";

const entry = { id: "entry", date: "2026-10-05", amount: "12.34", type: "-", category: "Food", subcategory: null, comment: null, currency: "USD" };
const category = { name: "Food", type: "-" };
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(actions) {
  const hooks = hookHarness();
  const Client = loadModule("app/(main)/account/finance/FinanceClient.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "next/link": "Link",
    "@radix-ui/react-dialog": {}, "lucide-react": {},
    "@/app/components/ui/button": { Button: "Button" },
    "@/app/components/ui/tabs": { Tabs: "Tabs", TabsContent: "TabsContent", TabsList: "TabsList", TabsTrigger: "TabsTrigger" },
    "@/lib/actions/finance.actions": actions,
    "@/lib/finance": loadModule("lib/finance.ts"),
    "@/lib/finance-playground": loadModule("lib/finance-playground.ts"),
    "@/hooks/use-finance-order": { useFinanceOrder: entries => ({ ordered: entries, saveOrder: () => true, orderEntries: entries => entries }) },
    "./FinanceViews": { FinanceBoard: "Board", FinanceDashboard: "Dashboard", FinanceHistory: "History", FinancePlayground: "Playground" },
    "./FinanceViewTransition": "ViewTransition", "./FinanceSelect": "Select",
    "./FinanceEditor": { __esModule: true, default: "Editor", financeDialogClass: "" },
    "./HoldDeleteButton": "HoldDelete",
  }).default;
  const render = () => hooks.render(() => Client({ initialRevision: 0, initialEntries: [entry], initialCategories: [category], userId: "fixture" }));
  const board = () => findNode(render(), node => node.type === "Board").props;
  const playground = () => findNode(render(), node => node.type === "Playground").props;
  const undo = () => findNode(render(), node => node.type === "Button" && node.props.children === "Undo");
  return { render, board, playground, undo };
}

test("Finance inline Undo restores transaction type; failed moves preserve records and show an error", async () => {
  const writes = [];
  let fail = false;
  const state = fixture({ commitFinance: async command => { writes.push(plain(command)); return fail ? {success:false,status:"rejected",message:"Could not move"} : {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:writes.length,entries:[{id:entry.id,...command.data.entry}],categories:[category]}}; } });
  state.board().onMove(entry, "+"); await tick();
  assert.equal(state.board().entries[0].type, "+");
  state.undo().props.onClick(); await tick();
  assert.equal(state.board().entries[0].type, "-");
  assert.equal(state.undo(), undefined);
  assert.deepEqual(writes.map(command=>[command.data.id,command.data.entry.type,command.revision]), [["entry", "+", 0], ["entry", "-", 1]]);
  assert.notEqual(writes[0].operationId,writes[1].operationId);
  fail = true;
  state.board().onMove(entry, "+"); await tick();
  assert.equal(state.board().entries[0].type, "-");
  assert.equal(findNode(state.render(), node => node.props?.role === "alert").props.children, "Could not move");
});

test("Finance category removal keeps transactions and exposes inline restoration", async () => {
  let restored = 0;
  const state = fixture({
    commitFinance: async command => { if(!command.data.hidden) restored++; return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:command.revision+1,entries:[entry],categories:[{...category,hidden:command.data.hidden}]}}; },
  });
  await state.playground().onRemoveCategory(category);
  assert.equal(state.board().entries.length, 1);
  assert.ok(state.undo());
  state.undo().props.onClick(); await tick();
  assert.equal(restored, 1);
  assert.equal(state.undo(), undefined);
  assert.deepEqual(plain(state.board().entries[0]), entry);
});

test("Finance quick-add retains one envelope across a lost response and clears the confirmed draft before another create", async () => {
  const commands=[];let fail=true;
  const state=fixture({commitFinance:async command=>{commands.push(plain(command));if(fail)throw Error('Lost response');return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:1,entries:[entry,{...command.data.entry,id:command.data.id}],categories:[category]}};}});
  const draft={...entry,subcategory:'Draft detail',comment:'Draft note'};delete draft.id;
  await assert.rejects(state.playground().onSave(null,draft),/confirm/);
  assert.equal(state.playground().busy,true);assert.equal(state.board().entries.length,1);
  await assert.rejects(state.playground().onSave(null,{...draft,amount:'55.00'}),/pending/);assert.equal(commands.length,1);
  fail=false;state.playground().recovery.props.onRetry();await tick();
  assert.deepEqual(commands[1],commands[0]);assert.equal(state.playground().busy,false);assert.equal(state.board().entries.length,2);
  assert.equal(state.playground().initialAmount,'0.00');
  await state.playground().onSave(null,draft);assert.notEqual(commands[2].data.id,commands[0].data.id);assert.notEqual(commands[2].operationId,commands[0].operationId);
});

test("Finance conflict keeps the editor draft, shows latest values, and only explicit review retries with a new revision",async()=>{
  const commands=[];const latest={...entry,amount:'99.00',comment:'Other device'};
  const state=fixture({commitFinance:async command=>{commands.push(plain(command));return commands.length===1?{success:false,status:'conflict',message:'Review newer changes',snapshot:{revision:8,entries:[latest],categories:[category]}}:{success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:9,entries:[{id:entry.id,...command.data.entry}],categories:[category]}};}});
  state.board().onEdit(entry);let editor=findNode(state.render(),node=>node.type==='Editor').props;
  const draft={...entry,amount:'15.00',subcategory:'My detail',comment:'My unsaved note'};delete draft.id;
  await assert.rejects(editor.onSave(entry.id,draft),/Review/);
  editor=findNode(state.render(),node=>node.type==='Editor').props;
  assert.equal(editor.entry.amount,'12.34');assert.equal(editor.blocked,true);assert.equal(state.board().entries[0].amount,'99.00');
  assert.match(editor.recovery.props.draft,/15.00.*My detail.*My unsaved note/);assert.match(editor.recovery.props.latest,/99.00.*Other device/);
  editor.onClose();assert.ok(findNode(state.render(),node=>node.type==='Editor'));assert.equal(commands.length,1);
  editor.recovery.props.onRetry();await tick();
  assert.equal(commands[1].revision,8);assert.notEqual(commands[1].operationId,commands[0].operationId);assert.deepEqual(commands[1].data,commands[0].data);
  assert.equal(state.board().entries[0].amount,'15.00');assert.equal(findNode(state.render(),node=>node.type==='Editor'),undefined);
});

test("Finance deleted-record conflict offers discard without an edit retry and retains unrelated quick-entry state",async()=>{
  const state=fixture({commitFinance:async()=>({success:false,status:'conflict',message:'Deleted elsewhere',snapshot:{revision:4,entries:[],categories:[category]}})});
  state.board().onEdit(entry);const editor=findNode(state.render(),node=>node.type==='Editor').props;
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
