"use client";

export function WeekdaySelector({days,onChange,disabled=false}:{days:number[];onChange:(days:number[])=>void;disabled?:boolean}) {
  return <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1.5">
    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,index)=><button key={day} type="button" disabled={disabled} aria-pressed={days.includes(index)} onClick={()=>onChange(days.includes(index)?days.filter(value=>value!==index):[...days,index].sort((a,b)=>a-b))} className={`min-h-11 rounded-xl border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--event-accent)] disabled:opacity-50 ${days.includes(index)?'border-[var(--event-accent)] bg-[color-mix(in_srgb,var(--event-accent)_12%,transparent)] text-[var(--event-accent)]':'border-border text-muted-foreground'}`}>{day}</button>)}
  </div>;
}
