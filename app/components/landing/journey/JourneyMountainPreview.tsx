"use client";

import JourneyScene from "./JourneyScene";
import type { ReactNode } from "react";
import styles from "./journey.module.css";

export default function JourneyMountainPreview({ children }: { children: ReactNode }) {
  return (
    <div className={styles.interactive}>
      <section className={`${styles.hero} ${styles.marketingHero}`} aria-labelledby="journey-heading">
        <div className={styles.artLayer} inert style={{ pointerEvents: "none", userSelect: "none" }}>
          <JourneyScene arrival={null} />
        </div>
        {children}
      </section>
    </div>
  );
}
