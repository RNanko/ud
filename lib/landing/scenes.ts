export const heroScenes = [
  { id:"finance", name:"Finance", caption:"Know where your money goes.", detail:"Bring expenses, income, and personal money goals into one clear view.", example:"Recorded balance · $2,500", facts:["Minimum goal · $1,000", "Above minimum · $1,500"] },
  { id:"investments", name:"Investments", caption:"Keep your investment plan in view.", detail:"Track your records and follow the contribution goals you chose.", example:"Monthly contribution goal", facts:["40 / 100 USD recorded", "60 USD remaining"] },
  { id:"todo", name:"To-Do", caption:"Turn plans into finished actions.", detail:"Organize the small steps behind the things that matter to you.", example:"Car purchase · Completed", facts:["Compare options · Completed", "Arrange inspection · Completed", "Complete purchase · Completed"] },
  { id:"events", name:"Events", caption:"Make room for real life.", detail:"Plan your week around work, training, and the experiences you choose.", example:"Friday · 18:30 · Meet-up", facts:["Planned · Attendance not confirmed"] },
  { id:"gym", name:"Gym", caption:"Train with a plan. Track what you do.", detail:"Choose a workout, record your sets or cardio, and see it in your week.", example:"Workout · Confirmed completed", facts:["Weekly goal · 3 / 3 sessions"] },
] as const;
export function sceneSource(index:number,mobile:boolean,wide:boolean) {
  const id=heroScenes[index]?.id ?? heroScenes[0].id;
  return `/manforth/${id}-${mobile?"mobile":wide?"1672":"1100"}.webp`;
}
