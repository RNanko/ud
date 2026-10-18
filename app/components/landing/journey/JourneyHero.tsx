import Link from "next/link";
import { ArrowRight, CalendarDays, Dumbbell, ListTodo, Mountain, TrendingUp, Wallet } from "lucide-react";
import { MainAction } from "../LandingProvider";
import JourneyMountainPreview from "./JourneyMountainPreview";
import JourneyPrice from "./JourneyPrice";
import styles from "./journey.module.css";

const featureLinks = [
  { label: "Finance", href: "/features/money-tracker", icon: Wallet },
  { label: "Investments", href: "/features/investment-tracker", icon: TrendingUp },
  { label: "To-Do", href: "/features/to-do", icon: ListTodo },
  { label: "Events", href: "/features/weekly-planner", icon: CalendarDays },
  { label: "Gym", href: "/features/workout-planner", icon: Dumbbell },
];

export default function JourneyHero() {
  return (
    <div className={styles.liveHero}>
      <JourneyMountainPreview>
        <div className={styles.heroCopy}>
          <div className={styles.copyTitle}>
            <p className={styles.copyBadge}><Mountain size={20} aria-hidden /> Your next step starts here</p>
            <h1 id="journey-heading">Small steps.<br />A stronger <span>you.</span></h1>
          </div>
          <p className={styles.copyDescription}>Make time for what matters. Plan your days, build your strength, and take charge of your money — one step at a time.</p>
          <div className={styles.copyActions}>
            <MainAction compact />
            <Link href="/#how-it-works" className={styles.exploreLink}>Explore ManForth <ArrowRight size={17} aria-hidden /></Link>
          </div>
          <JourneyPrice />
        </div>
        <nav id="journey-feature-links" className={styles.featureNav} aria-label="Explore ManForth features">
          {featureLinks.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} prefetch={false}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </JourneyMountainPreview>
    </div>
  );
}
