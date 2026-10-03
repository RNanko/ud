import test from "node:test";
import assert from "node:assert/strict";
import { hookHarness, loadModule, plain } from "./helpers.mjs";
import { library } from "./gym-fixture.mjs";

const names = loadModule("lib/gym/workout-name.ts");
test("workout names come from primary exercise data, deduplicate groups and ignore selection order", () => {
  const choose = ids => ids.map(id => library.find(exercise => exercise.id === id));
  assert.equal(names.suggestWorkoutName([]), "");
  assert.equal(names.suggestWorkoutName(choose(["bench-press", "incline-dumbbell-press"])), "Chest day");
  assert.equal(names.suggestWorkoutName(choose(["lat-pulldown", "seated-row"])), "Back day");
  assert.equal(names.suggestWorkoutName(choose(["bench-press", "triceps-pushdown"])), "Chest / Triceps day");
  assert.equal(names.suggestWorkoutName(choose(["triceps-pushdown", "bench-press"])), "Chest / Triceps day");
  assert.equal(names.suggestWorkoutName(choose(["bench-press", "seated-row", "squat"])), "Full body day");
  assert.equal(names.suggestWorkoutName([{ ...library[0], name: "Leg day", category: "Arms", primaryMuscles: ["Biceps"] }]), "Biceps day");
});

test("unit settings use the owned saved preferences and retry the same failed change", async()=>{
 const hooks=hookHarness();const {defaultPreferences,defaultNotifications}=loadModule('lib/account/preferences.ts');
 let settings={preferences:{...defaultPreferences,exerciseLoad:'lb',distance:'mi'},notifications:defaultNotifications,revision:2},fail=false;
 const {useGymUnits}=loadModule('hooks/use-gym-units.ts',{react:hooks.react,'@/app/components/shared/account/AccountPreferencesProvider':{useAccountPreferences:()=>({settings,replace:value=>settings=value})},'@/lib/actions/account.actions':{saveAccountSettings:async input=>{assert.equal(input.revision,settings.revision);if(fail)throw Error('offline');return {...settings,preferences:input.value,revision:settings.revision+1};}}});
 const render=()=>hooks.render(useGymUnits);
 assert.deepEqual(plain(render().units),{weight:'lb',distance:'mi'});
 fail=true;await render().changeUnits({weight:'kg',distance:'km'});assert.equal(render().state,'failed');assert.deepEqual(plain(render().units),{weight:'lb',distance:'mi'});
 fail=false;await render().retry();assert.equal(render().state,'saved');assert.deepEqual(plain(render().units),{weight:'kg',distance:'km'});assert.equal(settings.preferences.bodyWeight,defaultPreferences.bodyWeight);
});
