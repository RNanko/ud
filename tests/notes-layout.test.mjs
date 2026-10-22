import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule, hookHarness} from './helpers.mjs';

const layout=loadModule('lib/notes/layout.ts');

test('automatic card height updates its grid space when content grows or wraps',()=>{
 const hooks=hookHarness(),effects=[];
 let measure,observed,disconnected=false,height=180;
 const {useNoteCardLayout}=loadModule('hooks/use-note-card-layout.ts',{
  react:{...hooks.react,useEffect:fn=>effects.push(fn)},
  '@/lib/notes/layout':layout,
 },{ResizeObserver:class{
  constructor(callback){measure=callback;}
  observe(card){observed=card;}
  disconnect(){disconnected=true;}
 }});
 const render=()=>hooks.render(()=>useNoteCardLayout());
 const value=render(),card={getBoundingClientRect:()=>({height})};
 value.cardRef.current=card;
 const cleanup=effects.splice(0).map(effect=>effect());
 assert.equal(observed,card);
 for(const next of [536,603,204]){
  height=next;measure();
  const updated=render();
  assert.equal(updated.height,next);
  const space=updated.slotStyle['--note-rows']*layout.NOTE_GRID.row;
  assert.ok(space>=next+layout.NOTE_GRID.gap);
  assert.ok(space<next+layout.NOTE_GRID.gap+layout.NOTE_GRID.row);
 }
 cleanup.forEach(fn=>fn?.());
 assert.equal(disconnected,true);
});
