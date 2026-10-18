import {
  Wallet,
  TrendingUp,
  ListTodo,
  CalendarDays,
  Dumbbell,
  Compass,
  NotebookPen,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { featureCopy } from "@/lib/landing/copy";
import type { PublicPath } from "@/lib/seo/public-pages";
import FeaturePreview from "./FeaturePreview";
const destinations: Record<typeof featureCopy[number]["id"], PublicPath> = {
  finance: "/features/money-tracker",
  investments: "/features/investment-tracker",
  notes: "/features/notes",
  todo: "/features/to-do",
  events: "/features/weekly-planner",
  gym: "/features/workout-planner",
  momentum: "/features/goal-tracker",
};
const icons = { finance: Wallet, investments: TrendingUp, notes: NotebookPen, todo: ListTodo, events: CalendarDays, gym: Dumbbell, momentum: Compass };
const overviewFeatures = featureCopy.filter(feature => feature.id !== "notes");
export default function FeatureOverview() {
  return (
    <section
      id="features"
      className="mf-section mf-feature-overview"
      aria-labelledby="features-heading"
    >
      <div className="mf-section-top">
        <div>
          <p className="mf-eyebrow">Your everyday system</p>
          <h2 id="features-heading">
            Money, plans, progress.
            <br />
            <span className="mf-feature-heading-detail">Your day in one place.</span>
          </h2>
        </div>
        <p>
          Six tools for your everyday life.
          <br />
          Momentum connects the progress.
        </p>
      </div>
      <nav className="mf-feature-links" aria-label="Explore everyday tools">
        {overviewFeatures.map(feature => {
          const Icon = icons[feature.id];
          return (
            <a key={feature.id} href={destinations[feature.id]} className="mf-feature-link">
              <span className="mf-feature-link-top"><Icon size={20} aria-hidden="true" /><ChevronRight size={16} aria-hidden="true" /></span>
              <span>{feature.name}</span>
            </a>
          );
        })}
      </nav>
      <div className="mf-feature-grid">
        {overviewFeatures.map((feature, index) => {
          const Icon = icons[feature.id];
          const href = destinations[feature.id];
          return (
            <Card
              className="mf-feature"
              key={feature.id}
              id={`feature-${feature.id}`}
            >
              <div className="mf-feature-top">
                <Icon size={23} />
                <span>
                  {String(index + 1).padStart(2, "0")} / {feature.name}
                </span>
              </div>
              <h3>{feature.heading}</h3>
              <p>{feature.body}</p>
              <FeaturePreview module={feature.id} />
              <a
                href={href}
                className="mf-feature-example"
                aria-label={`Read how ${feature.name} works in ManForth`}
              >
                <span>
                  {`How ${feature.name} works`}
                </span>
                <ChevronRight size={15} />
              </a>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
