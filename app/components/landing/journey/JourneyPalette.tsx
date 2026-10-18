import { features, type FeatureId } from "./journey-config";
import type { ReactNode } from "react";
import JourneyFeatureCard from "./JourneyFeatureCard";
import styles from "./journey.module.css";

export default function JourneyPalette({ selected, onChoose, children }: { selected: FeatureId | null; onChoose: (id: FeatureId) => void; children: ReactNode }) {
  return <section className={styles.palette} aria-labelledby="palette-title">
    <div className={styles.paletteHeading}><h2 id="palette-title">Build your journey</h2><p>Choose a card, then a checkpoint. Or drag with a mouse.</p></div>
    <div className={styles.paletteCards}>{features.map(feature => <JourneyFeatureCard key={feature.id} feature={feature} selected={selected === feature.id} onChoose={() => onChoose(feature.id)} />)}</div>
    {children}
  </section>;
}
