import test from "node:test";
import assert from "node:assert/strict";
import { events, fixture, dates, timing, validation } from "./gym-fixture.mjs";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";

test("all five event colors survive saving, completion, reopening and preset reuse", async () => {
  for (const tone of ["blue", "orange", "yellow", "red", "green"]) {
    const state = fixture(), event = {id:crypto.randomUUID(),title:"Colored event",completed:false,tone};
    const board = tasks => [{id:"monday",day:"Monday",tasks}];
    const save = (before,data) => state.planner.saveEventBoard({week:"2026-WK41",mutationId:crypto.randomUUID(),before,data});
    const created = await save([],board([event]));
    assert.equal(created.success,true); assert.equal(created.data[0].tasks[0].tone,tone);
    const completed = await save(created.data,board([{...event,completed:true}]));
    assert.equal(completed.success,true); assert.equal(completed.data[0].tasks[0].tone,tone);
    const reopened = await save(completed.data,board([{...completed.data[0].tasks[0],completed:false}]));
    assert.equal(reopened.success,true); assert.equal(reopened.data[0].tasks[0].tone,tone);
    assert.equal((await state.planner.saveEventPreset({event})).success,true);
    assert.equal((await state.planner.getEventPresets())[0].tone,tone);
    const copied = events.resetPreset(reopened.data,id => "copy:" + id);
    assert.equal(copied[0].tasks[0].tone,tone);
    const items = events.plannerItems(reopened.data,{plans:[],sessions:[]},"2026-10-05");
    assert.equal(items[0].manual.tone,tone);
  }
});

test("legacy events without a color remain valid, while unsupported colors are rejected before a write", async () => {
  const event = {id:crypto.randomUUID(),title:"Legacy",completed:false};
  assert.equal(events.eventSchema.safeParse(event).success,true);
  const state=fixture();
  for(const tone of ["purple","#ff0000"]) {
    const result=await state.planner.saveEventBoard({week:"2026-WK41",mutationId:crypto.randomUUID(),before:[],data:[{id:"monday",day:"Monday",tasks:[{...event,tone}]}]});
    assert.equal(result.success,false);
  }
  assert.equal(state.rows.userEvents.length,0);
});

test("the editor saves the selected color and retains it unchanged on a failed-save retry", async () => {
  const harness=hookHarness(), saved=[]; let fail=true;
  let rejectSave;
  const delayedSave = new Promise((resolve, reject) => { rejectSave = reject; });
  const Editor=loadModule("app/(main)/account/events/EventEditor.tsx",{
    react:harness.react,"react/jsx-runtime":jsxRuntime,"@/lib/events":events,"@/lib/gym/dates":dates,
    "@/lib/gym/validation":validation,"@/lib/planner-time":timing,
    "../gym/GymUI":Object.fromEntries(["Field","GymButton","GymDialog","GymSelect","Notes"].map(type=>[type,type])),
    "./TimingFields":"TimingFields","./EventDatePicker":"EventDatePicker","./EventColorPicker":"EventColorPicker",
    "./EventCompletionCheckbox": { EventLoadingSpinner: "EventLoadingSpinner" },
  }).default;
  const render=()=>harness.render(()=>Editor({date:"2026-10-05",onClose(){},onSave:async(event,date)=>{saved.push(plain({event,date}));if(fail)await delayedSave;}}));
  findNode(render(),node=>node.type==="Field"&&node.props.label==="Event title").props.onChange({target:{value:"Reading"}});
  findNode(render(),node=>node.type==="EventColorPicker").props.onChange("green");
  assert.equal(findNode(render(), node=>node.type==="GymDialog").props["data-event-tone"], "green");
  findNode(render(),node=>node.type==="GymButton"&&node.props.children==="Save event").props.onClick();
  const saving = findNode(render(),node=>node.type==="GymButton"&&node.props["aria-busy"]);
  assert.equal(saving.props.disabled,true);
  assert.equal(saving.props.children.type,"EventLoadingSpinner");
  assert.equal(saving.props["aria-label"],"Saving event");
  assert.equal(findNode(render(),node=>node.type==="GymDialog").props["data-event-tone"],"green");
  rejectSave(Error("offline"));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved[0].event.tone,"green");
  assert.equal(findNode(render(),node=>node.type==="EventColorPicker").props.disabled,true);
  fail=false;
  findNode(render(),node=>node.type==="GymButton"&&node.props.children==="Retry save").props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(saved[0],saved[1]);
});
