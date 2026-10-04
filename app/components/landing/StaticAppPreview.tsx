import { CalendarDays, Dumbbell, Compass } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { sampleOccurrence } from "@/lib/landing/demo";
import FeaturePreview from "./FeaturePreview";

/** Public SSR presentation fixtures share real UI surfaces; never read private account state. */
export default function StaticAppPreview() {
  return <>
    <section className="mf-section" id="explore" aria-labelledby="preview-heading">
      <div className="mf-section-top"><div><p className="mf-eyebrow">Inside your workspace</p><h2 id="preview-heading">Plan your week.<br />Record your <span>work.</span></h2></div><p>A connected place to plan, act, and see your progress.</p></div>
      <div className="mf-preview-shell"><div className="mf-preview-bar"><span className="mf-monogram">MF</span><span>Your workspace</span><small>Example data · interactive preview loads when visible</small></div>
        <div className="mf-static-demo"><p className="mf-eyebrow"><CalendarDays size={16} />Weekly plan · Optional time</p><h3>{sampleOccurrence.name}</h3><p>{sampleOccurrence.date} · Planned · No time required</p><p>4 exercises · ~45 minutes</p><FeaturePreview module="gym" /><p className="mf-small">Select a module in the interactive preview to explore Events, Gym, Momentum, tasks and money records.</p></div>
      </div>
    </section>
    <section id="how-it-works" className="mf-section mf-workflow" aria-labelledby="workflow-heading"><div className="mf-section-top"><div><p className="mf-eyebrow">From intention to a recorded result</p><h2 id="workflow-heading">Plan it. Do it.<br /><span>See it count.</span></h2></div><p>One workout, connected across your week.<br />No double counting. No invented results.</p></div>
      <div className="mf-workflow-grid">{[
        {icon:CalendarDays,title:"Make room in Events",body:`${sampleOccurrence.date} · ${sampleOccurrence.name}`,status:"Planned · Not yet confirmed"},
        {icon:Dumbbell,title:"Record the work in Gym",body:"Keep the plan. Record what actually happened.",status:"Awaiting completion"},
        {icon:Compass,title:"Let Momentum count it",body:"Confirmed Gym sessions and their linked Events occurrences count once.",status:"Example weekly training goal: 2 of 3"},
      ].map((step,i)=><Card key={step.title} className="mf-workflow-card"><span className="mf-step-number">0{i+1}</span><step.icon/><h3>{step.title}</h3><p>{step.body}</p><span className="mf-status">{step.status}</span></Card>)}</div>
    </section>
  </>;
}

export function StaticMomentumPreview() {
  return <section id="momentum" className="mf-section mf-momentum" aria-labelledby="momentum-heading"><div className="mf-momentum-copy"><p className="mf-eyebrow"><Compass size={16} />The thread that connects it</p><h2 id="momentum-heading">Choose your goals.<br />Connect your actions.<br /><span>Review your progress.</span></h2><p>Momentum brings Goal Tracker, Journeys, Recent Wins and a short Weekly Review together. Follow the rules you chose, using the actions you actually recorded.</p><p className="mf-small">Focus minutes are logged time, not proof of mastery. Money goals use manual Momentum records, not investment returns.</p></div><Card className="mf-momentum-preview"><FeaturePreview module="momentum" /><div className="mf-goal-row"><span>Example weekly training goal<small>Confirmed sessions · Gym / linked Events</small></span><strong>2 / 3</strong></div><progress value={2} max={3} className="mf-progress" aria-label="Example: two confirmed workouts of a target of three" /></Card></section>;
}
