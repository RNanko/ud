import { Check, CalendarDays } from "lucide-react";
import TaskBody from "@/app/components/shared/TaskBody";
import type { featureCopy } from "@/lib/landing/copy";
/** Compact, read-only presentation fixtures; no account hooks or network requests. */
export default function FeaturePreview({module}:{module:typeof featureCopy[number]["id"]}){
 return <div className="mf-mini-preview" aria-label={`${module} preview with example data`}>
  <span className="mf-mini-label">Example data</span>
  {module==="finance"&&<><div className="mf-mini-row"><span>Recorded balance</span><strong>$2,500</strong></div><div className="mf-mini-row"><span>Revenue</span><span>$3,400</span></div><div className="mf-mini-row"><span>Spending</span><span>$900</span></div></>}
  {module==="investments"&&<><div className="mf-mini-row"><span>10 units · Cost</span><strong>800 USD</strong></div><div className="mf-mini-row"><span>Current value</span><strong>860 USD</strong></div><div className="mf-mini-row"><span>Unrealized profit</span><strong>+60 USD</strong></div><small>Illustrative position · not a completed sale</small></>}
  {module==="notes"&&<><div className="mf-mini-row"><strong>Weekend plan</strong><span>Pinned</span></div><p>Meet at the park entrance.</p><div className="mf-mini-completed"><Check size={14}/>Tickets ready</div><div className="mf-mini-row"><span>To pack</span><span>Water bottle</span></div><svg viewBox="0 0 240 64" role="img" aria-label="Example freehand sketch of a meeting point" className="w-full text-primary"><path d="M12 50 Q55 48 75 30 T130 34 T195 24 M170 15 L196 24 L178 43 M217 23 A8 8 0 1 0 217 39 A8 8 0 1 0 217 23" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><small>Text · Checklists · Freehand drawing</small></>}
  {module==="todo"&&<div className="todo-task rounded-xl border p-3"><TaskBody content="Arrange car inspection"/><span className="mf-mini-completed"><Check size={14}/>Completed</span></div>}
  {module==="events"&&<><div className="mf-mini-row"><CalendarDays size={16}/><strong>Friday · 18:30</strong></div><div className="mf-mini-row"><span>Meet-up</span><span>Planned</span></div><small>Optional time · completion is your confirmation</small></>}
  {module==="gym"&&<><div className="mf-mini-row"><span>Bench press</span><strong>User-entered plan</strong></div><div className="mf-mini-row"><span>3 × 10 · 60 kg</span><span>Actual: not recorded</span></div><small>Illustrative user-entered targets · not a recommendation</small></>}
  {module==="momentum"&&<><div className="mf-mini-row"><span>Actions</span><strong>Train consistently</strong></div><div className="mf-mini-row"><span>Weekly Review</span><span>What should change?</span></div><small>Goals · Actions · recorded progress</small></>}
 </div>;
}
