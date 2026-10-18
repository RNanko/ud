import type { Metadata } from "next";
import { launchPolicy } from "@/lib/account/config";
import LandingProvider from "@/app/components/landing/LandingProvider";
import LandingHeader from "@/app/components/landing/LandingHeader";
import JourneyHero from "@/app/components/landing/journey/JourneyHero";
import styles from "@/app/components/landing/journey/journey.module.css";
import "../landing.css";

export const metadata: Metadata = {
  title: "Mountain journey · Design preview",
  description: "Preview of the ManForth mountain journey hero.",
  robots: { index: false, follow: false },
};

export default function JourneyPreviewPage() {
  return (
    <LandingProvider trialDays={launchPolicy().trialDays}>
      <div className={`mf-landing ${styles.homeLanding}`}>
        <LandingHeader home={false} />
        <main id="main-content" tabIndex={-1}>
          <JourneyHero />
        </main>
      </div>
    </LandingProvider>
  );
}
