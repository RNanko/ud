"use client";
import { useReducer, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Dumbbell,
  ListTodo,
  Wallet,
  TrendingUp,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import WeekNavigator from "@/app/(main)/account/gym/WeekNavigatorView";
import TaskBody from "@/app/components/shared/TaskBody";
import {
  demoReducer,
  initialDemo,
  sampleOccurrence,
  demoWorkoutCount,
  type DemoState,
} from "@/lib/landing/demo";
const modules = [
  { name: "Events", icon: CalendarDays },
  { name: "Gym", icon: Dumbbell },
  { name: "Momentum", icon: Compass },
  { name: "To-Do", icon: ListTodo },
  { name: "Finance", icon: Wallet },
  { name: "Investments", icon: TrendingUp },
] as const;
// Same surface tokens, without pulling private dialogs, motion and account UI into the public demo.
function Panel({children,className="",label}:{children:ReactNode;className?:string;label?:string}) {
  return <section aria-label={label} className={`momentum-panel rounded-3xl border border-border bg-card/40 p-5 sm:p-6 ${className}`}>{children}</section>;
}
export default function AppPreview({ children }: { children: ReactNode }) {
  const [view, setView] = useState("Events"),
    [date, setDate] = useState<string>(sampleOccurrence.date),
    [demo, dispatch] = useReducer(demoReducer, initialDemo);
  const count = demoWorkoutCount(demo);
  const lane = (value: DemoState["taskLane"]) =>
    dispatch({ type: "task", lane: value });
  return (
    <>
      <section
        className="mf-section"
        id="explore"
        aria-labelledby="preview-heading"
      >
        <div className="mf-section-top">
          <div>
            <p className="mf-eyebrow">Inside your workspace</p>
            <h2 id="preview-heading">
              Plan your week.
              <br />
              Record your <span>work.</span>
            </h2>
          </div>
          <p>A connected place to plan, act, and see your progress.</p>
        </div>
        <div className="mf-preview-shell">
          <div className="mf-preview-bar">
            <span className="mf-monogram">MF</span>
            <span>Your workspace</span>
            <small>Example data · interactive preview</small>
          </div>
          <div className="mf-preview-layout">
            <div
              className="mf-preview-nav"
              role="group"
              aria-label="Preview a module"
            >
              {modules.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  aria-pressed={view === name}
                  onClick={() => setView(name)}
                >
                  <Icon size={20} />
                  <span>{name}</span>
                </button>
              ))}
            </div>
            <div className="mf-preview-content gym-scope momentum-scope">
              <div className="mf-preview-title">
                <h3>
                  {view === "Events"
                    ? "Your week, connected"
                    : view === "Gym"
                      ? "Plan your training"
                      : view === "Momentum"
                        ? "One useful step at a time"
                        : view === "To-Do"
                          ? "Make the next step clear"
                          : view === "Finance"
                            ? "Your money at a glance"
                            : "Your contribution plan"}
                </h3>
                <span className="mf-example-label">Example data</span>
              </div>
              {view === "Events" && (
                <>
                  <WeekNavigator
                    selected={date}
                    today={sampleOccurrence.date}
                    onSelect={setDate}
                  />
                  {demo.plannedDate === date ? (
                    <Card className="mf-example-card mt-5">
                      <p className="mf-eyebrow">
                        <CalendarDays size={14} />
                        Weekly plan · Optional time
                      </p>
                      <h4>{sampleOccurrence.name}</h4>
                      <p>
                        {demo.plannedDate} ·{" "}
                        {demo.completed
                          ? "Confirmed completed in Gym"
                          : "Planned · No time required"}
                      </p>
                      <p>4 exercises · ~45 minutes</p>
                      <Button variant="outline" onClick={() => setView("Gym")}>
                        Open linked workout
                        <ChevronRight size={16} />
                      </Button>
                    </Card>
                  ) : (
                    <Card className="mf-example-card mt-5">
                      <h4>No sample workout on this day</h4>
                      <p>
                        {date} · The example is scheduled for {demo.plannedDate}
                        .
                      </p>
                      <Button
                        variant="outline"
                        disabled={demo.completed}
                        onClick={() => dispatch({ type: "move", date })}
                      >
                        Move example workout here
                      </Button>
                    </Card>
                  )}
                </>
              )}
              {view === "Gym" && (
                <Card className="mf-example-card">
                  <p className="mf-eyebrow">
                    <Dumbbell size={16} />
                    {demo.completed
                      ? "Confirmed completed"
                      : "Planned training"}
                  </p>
                  <h4>{sampleOccurrence.name}</h4>
                  <p>
                    Bench press · Incline dumbbell press · Cable fly · Triceps
                    pushdown
                  </p>
                  <div className="mf-plan-actual">
                    <div>
                      <small>User-entered plan · Bench press</small>
                      <strong>3 × 10 · 60 kg</strong>
                    </div>
                    <div>
                      <small>Actual</small>
                      <strong>Not recorded</strong>
                    </div>
                  </div>
                  <p>
                    Completion can be confirmed without inventing set results.
                    Your original targets stay separate.
                  </p>
                  <Button
                    className="mf-orange-outline"
                    disabled={demo.completed}
                    onClick={() => dispatch({ type: "complete" })}
                  >
                    {demo.completed ? (
                      <>
                        <Check size={16} />
                        Completed
                      </>
                    ) : (
                      "Confirm sample workout completed"
                    )}
                  </Button>
                </Card>
              )}
              {view === "Momentum" && (
                <Panel
                  label="Example weekly training goal"
                  className="space-y-5"
                >
                  <p className="mf-eyebrow">
                    <Compass size={16} />
                    Goal Tracker · This example week
                  </p>
                  <h4 className="text-2xl font-semibold">Train consistently</h4>
                  <div className="mf-goal-number">
                    {count}
                    <span> / 3 sessions</span>
                  </div>
                  <progress
                    className="mf-progress"
                    value={count}
                    max={3}
                    aria-label={`${count} of 3 workouts confirmed`}
                  />
                  <p className="mf-small">
                    Source: confirmed Gym sessions and their linked Events
                    occurrence. The same workout counts once.
                  </p>
                </Panel>
              )}
              {view === "To-Do" && (
                <div className="todo-board">
                  <p className="mf-small mb-4">
                    Drag the whole sample task, or use the lane buttons. Nothing
                    is saved to your account.
                  </p>
                  <div className="mf-demo-lanes">
                    {(["to-do", "in-progress", "done"] as const).map(
                      (value) => (
                        <div
                          key={value}
                          className="todo-group rounded-2xl border p-3"
                          data-tone={
                            value === "done"
                              ? "green"
                              : value === "in-progress"
                                ? "yellow"
                                : "blue"
                          }
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (
                              e.dataTransfer.getData("text/plain") ===
                              "manforth-demo-task"
                            )
                              lane(value);
                          }}
                        >
                          <h4 className="todo-group-title mb-3 capitalize">
                            {value.replaceAll("-", " ")}
                          </h4>
                          {demo.taskLane === value && (
                            <div
                              className="todo-task rounded-xl border p-3"
                              draggable
                              onDragStart={(e) =>
                                e.dataTransfer.setData(
                                  "text/plain",
                                  "manforth-demo-task",
                                )
                              }
                            >
                              <TaskBody content="Prepare your training bag" />
                              {demo.taskDone && (
                                <p className="mt-2 text-xs">
                                  <Check size={14} className="inline" />
                                  Completed
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                  <div
                    className="mt-4 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Move sample task"
                  >
                    {(["to-do", "in-progress", "done"] as const).map(
                      (value) => (
                        <Button
                          key={value}
                          variant="outline"
                          aria-pressed={demo.taskLane === value}
                          onClick={() => lane(value)}
                        >
                          Move to {value.replaceAll("-", " ")}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              )}
              {view === "Finance" && (
                <Card className="mf-example-card">
                  <p className="mf-eyebrow">
                    <Wallet size={16} />
                    Recorded balance · USD
                  </p>
                  <h4>$2,500</h4>
                  <div className="mf-plan-actual">
                    <div>
                      <small>Revenue · USD</small>
                      <strong>$3,400</strong>
                    </div>
                    <div>
                      <small>Spending · USD</small>
                      <strong>$900</strong>
                    </div>
                  </div>
                  <p>
                    Keep spending and income in their recorded currencies.
                    Explore categories, dashboard and downloadable history.
                  </p>
                  <small className="mf-small">
                    An example balance; no bank connection or money movement.
                  </small>
                </Card>
              )}
              {view === "Investments" && (
                <Card className="mf-example-card">
                  <p className="mf-eyebrow">
                    <TrendingUp size={16} />
                    Contribution · USD only
                  </p>
                  <h4>40 / 100 USD</h4>
                  <progress
                    className="mf-progress"
                    value={40}
                    max={100}
                    aria-label="40 of 100 USD recorded contribution"
                  />
                  <p>
                    This month&apos;s recorded contribution, separate from
                    market profit or loss.
                  </p>
                  <small className="mf-small">
                    Track crypto and other manually added positions, purchase
                    price, quantity and date. Current-price availability depends
                    on the asset and provider.
                  </small>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>
      <section
        id="how-it-works"
        className="mf-section mf-workflow"
        aria-labelledby="workflow-heading"
      >
        <p className="mf-eyebrow">From intention to a recorded result</p>
        <div className="mf-section-top">
          <h2 id="workflow-heading">
            Plan it. Do it.
            <br />
            <span>See it count.</span>
          </h2>
          <p>
            One workout, connected across your week.
            <br />
            No double counting. No invented results.
          </p>
        </div>
        <div className="mf-workflow-grid">
          <Card className="mf-workflow-card">
            <span className="mf-step-number">01</span>
            <CalendarDays />
            <h3>Make room in Events</h3>
            <p>
              {demo.plannedDate} · {sampleOccurrence.name}
            </p>
            <span className="mf-status">
              {demo.completed
                ? "Linked workout completed"
                : "Planned · Not yet confirmed"}
            </span>
          </Card>
          <Card className="mf-workflow-card">
            <span className="mf-step-number">02</span>
            <Dumbbell />
            <h3>Confirm the work in Gym</h3>
            <p>
              {demo.completed
                ? "Completion confirmed. Sets and loads remain unrecorded."
                : "Keep the plan. Record what actually happened."}
            </p>
            <span className="mf-status mf-status-orange">
              {demo.completed ? "Confirmed completed" : "Awaiting completion"}
            </span>
          </Card>
          <Card className="mf-workflow-card">
            <span className="mf-step-number">03</span>
            <Compass />
            <h3>Let Momentum count it</h3>
            <p>This week&apos;s training goal</p>
            <strong className="mf-workflow-count">
              {count}
              <span> / 3</span>
            </strong>
            <progress
              className="mf-progress"
              value={count}
              max={3}
              aria-label={`Weekly training goal: ${count} of 3`}
            />
          </Card>
        </div>
        <div className="mf-demo-actions">
          <Button
            className="mf-primary"
            disabled={demo.completed}
            onClick={() => dispatch({ type: "complete" })}
          >
            {demo.completed ? (
              <>
                <Check />
                Example completed
              </>
            ) : (
              <>
                Try the example
                <ArrowRight />
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => dispatch({ type: "reset" })}>
            <RotateCcw size={16} />
            Reset demo
          </Button>
          <span className="mf-small" role="status">
            {demo.completed
              ? "One linked workout added. Weekly goal: 3 of 3."
              : "Example data only. Your account stays untouched."}
          </span>
        </div>
      </section>
      <div
        onClick={(event) => {
          const link =
            event.target instanceof Element
              ? event.target.closest<HTMLAnchorElement>("a[data-preview]")
              : null;
          if (
            link &&
            modules.some((module) => module.name === link.dataset.preview)
          )
            setView(link.dataset.preview!);
        }}
      >
        {children}
      </div>
      <section
        id="momentum"
        className="mf-section mf-momentum"
        aria-labelledby="momentum-heading"
      >
        <div className="mf-momentum-copy">
          <p className="mf-eyebrow">
            <Compass size={16} />
            The thread that connects it
          </p>
          <h2 id="momentum-heading">
            Choose your goals.
            <br />
            Connect your actions.
            <br />
            <span>Review your progress.</span>
          </h2>
          <p>
            Momentum brings Goal Tracker, Journeys, Recent Wins and a short
            Weekly Review together. Follow the rules you chose, using the
            actions you actually recorded.
          </p>
          <p className="mf-small">
            Balance maintenance is ongoing. Focus minutes are logged time, not
            proof of mastery. Contributions are money recorded, not investment
            returns.
          </p>
        </div>
        <Panel
          label="Momentum example goals"
          className="mf-momentum-preview momentum-scope"
        >
          <span className="mf-example-label">Example data</span>
          <div className="mf-goal-row">
            <span>
              Gym this week
              <small>Confirmed sessions · Gym / linked Events</small>
            </span>
            <strong>{count} / 3</strong>
          </div>
          <progress
            className="mf-progress"
            value={count}
            max={3}
            aria-label="Example workout goal"
          />
          {[
            {
              title: "Learning this week",
              value: "75 / 100 min",
              source: "Recorded focus time · Momentum",
              current: 75,
              max: 100,
            },
            {
              title: "Minimum balance",
              value: "$2,500",
              source: "Manual Momentum balance · $1,000 minimum",
              current: 100,
              max: 100,
            },
            {
              title: "Contribution this month",
              value: "40 / 100 USD",
              source: "Manual Momentum contributions · USD",
              current: 40,
              max: 100,
            },
          ].map((goal) => (
            <div key={goal.title}>
              <div className="mf-goal-row">
                <span>
                  {goal.title}
                  <small>{goal.source}</small>
                </span>
                <strong>{goal.value}</strong>
              </div>
              <progress
                className="mf-progress"
                value={goal.current}
                max={goal.max}
                aria-label={goal.title}
              />
            </div>
          ))}
          <label className="mf-reflection">
            What should change next week?
            <input
              maxLength={240}
              value={demo.reflection}
              onChange={(e) =>
                dispatch({ type: "reflection", text: e.target.value })
              }
            />
            <small>Editable Journey example · stays in this preview only</small>
          </label>
        </Panel>
      </section>
    </>
  );
}
