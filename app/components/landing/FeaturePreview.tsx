import { Check, CalendarDays } from "lucide-react";
import TaskBody from "@/app/components/shared/TaskBody";
import type { featureCopy } from "@/lib/landing/copy";
/** Compact, read-only presentation fixtures; no account hooks or network requests. */
export default function FeaturePreview({module}:{module:typeof featureCopy[number]["id"]}){
 return <div className="mf-mini-preview" aria-label={`${module} preview with example data`}>
  <span className="mf-mini-label">Example data</span>
  {module==="finance"&&<><div className="mf-mini-row"><span>Recorded balance</span><strong>$2,500</strong></div><div className="mf-mini-row"><span>Revenue</span><span>$3,400</span></div><div className="mf-mini-row"><span>Spending</span><span>$900</span></div></>}
  {module==="investments"&&<><div className="mf-mini-row"><span>Monthly contribution</span><strong>40 / 100 USD</strong></div><progress className="mf-progress" max={100} value={40} aria-label="Example contribution: 40 of 100 USD"/><small>Recorded contributions · 60 USD remaining</small></>}
  {module==="todo"&&<div className="todo-task rounded-xl border p-3"><TaskBody content="Arrange car inspection"/><span className="mf-mini-completed"><Check size={14}/>Completed</span></div>}
  {module==="events"&&<><div className="mf-mini-row"><CalendarDays size={16}/><strong>Friday · 18:30</strong></div><div className="mf-mini-row"><span>Meet-up</span><span>Planned</span></div><small>Optional time · completion is your confirmation</small></>}
  {module==="gym"&&<><div className="mf-mini-row"><span>Bench press</span><strong>User-entered plan</strong></div><div className="mf-mini-row"><span>3 × 10 · 60 kg</span><span>Actual: not recorded</span></div><small>Illustrative user-entered targets · not a recommendation</small></>}
  {module==="momentum"&&<><div className="mf-mini-row"><span>Journey</span><strong>Train consistently</strong></div><div className="mf-mini-row"><span>Weekly Review</span><span>What should change?</span></div><small>Goals · Recent Wins · recorded actions</small></>}
 </div>;
}
