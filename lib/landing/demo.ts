/** Synthetic fixture. Never persisted or passed to account actions. */
export const sampleOccurrence = { id: "demo-workout-occurrence", name: "Chest / Triceps Day", date: "2026-10-01", minutes: 45, exercises: 4 } as const;
export type DemoState = { occurrenceId:string; plannedDate:string; completed:boolean; taskDone:boolean; taskLane:"to-do"|"in-progress"|"done"; reflection:string };
export const initialDemo:DemoState = { occurrenceId:sampleOccurrence.id, plannedDate:sampleOccurrence.date, completed:false, taskDone:false, taskLane:"to-do", reflection:"Make Thursday training easier to start." };
export type DemoAction = {type:"complete"}|{type:"reset"}|{type:"move";date:string}|{type:"task";lane:DemoState["taskLane"]}|{type:"reflection";text:string};
export function demoReducer(state:DemoState,action:DemoAction):DemoState {
  if(action.type==="reset")return {...initialDemo};
  if(action.type==="complete")return state.completed?state:{...state,completed:true};
  if(action.type==="move")return state.completed?state:{...state,plannedDate:action.date};
  if(action.type==="task")return {...state,taskDone:action.lane==="done",taskLane:action.lane};
  return {...state,reflection:action.text.slice(0,240)};
}
export function demoWorkoutCount(state:DemoState){return 2+(state.completed?1:0);}
