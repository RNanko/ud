import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Compass,
  Dumbbell,
  ListTodo,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { GymButton } from "@/app/(main)/account/gym/GymUI";

const tools = [
  {
    name: "Finance",
    icon: Wallet,
    href: "/account/finance",
    heading: "Know where your money goes.",
    description: "Record spending and income with a date, category, detail and note. Review your totals and download your history as CSV.",
    workflow: "Add an entry · Review the dashboard · Explore history",
  },
  {
    name: "Investments",
    icon: TrendingUp,
    href: "/account/investments",
    heading: "Keep your portfolio in view.",
    description: "Record positions with their purchase price, quantity and date. Review available current prices and track the contributions you choose. Values are shown in USD.",
    workflow: "Add a position · Record contributions · Review value",
  },
  {
    name: "To-Do",
    icon: ListTodo,
    href: "/account/to-do",
    heading: "Give each task a next step.",
    description: "Write down what needs doing. Reorder tasks and move them through your board as you work, using drag-and-drop or keyboard controls.",
    workflow: "To do → In progress → Done",
  },
  {
    name: "Events",
    icon: CalendarDays,
    href: "/account/events",
    heading: "Make room for what matters.",
    description: "Plan your week with dates and optional times. Reuse event or week presets, connect training to Gym, and confirm events when they are done.",
    workflow: "Choose a day · Plan an event · Confirm completion",
  },
  {
    name: "Gym",
    icon: Dumbbell,
    href: "/account/gym",
    heading: "Plan training. Log the actual work.",
    description: "Build reusable workouts and plan them in your week, or log a workout directly. You choose weights and repetitions; actual sets and cardio results stay separate from planned targets.",
    workflow: "Choose exercises · Plan or start · Review history",
  },
  {
    name: "Momentum",
    icon: Compass,
    href: "/account/momentum",
    heading: "Turn daily actions into progress.",
    description: "Choose one useful next move. Connect actions to Journeys, set your own Goal Tracker rules, look back at Recent Wins and reflect in a Weekly Review.",
    workflow: "Choose an action · Record progress · Review your week",
  },
  {
    name: "Notifications",
    icon: Bell,
    href: "/account/notifications",
    heading: "See what needs your attention.",
    description: "Find in-app reminders and updates in one inbox. Opening a message marks it read. Choose which messages you receive and set quiet hours in account settings.",
    workflow: "Open the inbox · Read a message · Adjust preferences",
  },
] as const;

const firstSteps = [
  { title: "Plan your week", detail: "Give an event a date.", href: "/account/events" },
  { title: "Choose one task", detail: "Start with a useful action.", href: "/account/to-do" },
  { title: "Connect your progress", detail: "Find your next move in Momentum.", href: "/account/momentum" },
] as const;

export default function AppGuide({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="account-guide space-y-6">
      <section className="account-guide-intro rounded-2xl border p-5 sm:p-6" aria-labelledby="guide-intro-title">
        <p className="text-xs font-medium uppercase tracking-[.14em] text-primary-plus">Get to know ManForth</p>
        <h3 id="guide-intro-title" className="mt-3 text-2xl font-semibold tracking-tight">A place for every part of your day.</h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Plan what matters, record what you do and see your progress. Start with the tool you need today; build the rest at your own pace.</p>
      </section>

      <section aria-labelledby="guide-start-title" className="space-y-3">
        <h3 id="guide-start-title" className="font-semibold">A simple way to start</h3>
        <ol className="account-guide-steps">
          {firstSteps.map((step, index) => (
            <li key={step.href}>
              <Link href={step.href} prefetch={false} className="account-guide-step rounded-2xl border p-4">
                <span aria-hidden="true" className="account-guide-step-number">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{step.detail}</span>
                </span>
                <ArrowRight size={16} aria-hidden="true" className="ml-auto shrink-0 text-primary-plus" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="account-guide-grid">
        {tools.map((tool) => (
          <article key={tool.name} aria-labelledby={`guide-${tool.name.toLowerCase()}`}>
            <Card className="account-guide-card h-full gap-4 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="account-guide-icon"><tool.icon size={21} aria-hidden="true" /></span>
                <h3 id={`guide-${tool.name.toLowerCase()}`} className="text-lg font-semibold">{tool.name}</h3>
              </div>
              <p className="font-medium leading-snug">{tool.heading}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
              <p className="mt-auto border-t pt-4 text-xs leading-relaxed text-muted-foreground">{tool.workflow}</p>
              <Link href={tool.href} prefetch={false} className="account-guide-link inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-2 text-sm font-medium text-primary-plus">
                Open {tool.name}<ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Card>
          </article>
        ))}
        <article aria-labelledby="guide-settings">
          <Card className="account-guide-card h-full gap-4 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="account-guide-icon"><SlidersHorizontal size={21} aria-hidden="true" /></span>
              <h3 id="guide-settings" className="text-lg font-semibold">Account & Settings</h3>
            </div>
            <p className="font-medium leading-snug">Make ManForth work for you.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Manage your profile, currency, units, timezone and notifications. Change security details, review membership, export your data and visit the Terms and Privacy Policy.</p>
            <p className="mt-auto border-t pt-4 text-xs leading-relaxed text-muted-foreground">Personal preferences · Security · Membership · Your data</p>
            <GymButton tone="blue" className="self-start" onClick={onOpenSettings}>Open preferences<ArrowRight size={16} aria-hidden="true" /></GymButton>
          </Card>
        </article>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div><p className="text-sm font-semibold">Need a specific answer?</p><p className="mt-1 text-xs text-muted-foreground">Find more details in Help & Q&A.</p></div>
        <Link href="/help" prefetch={false} className="account-guide-link inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary-plus">Open Help & Q&A<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
