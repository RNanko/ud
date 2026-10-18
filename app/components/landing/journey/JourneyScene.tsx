"use client";
import { getImageProps } from "next/image";
import JourneySky from "./JourneySky";
import JourneyRoute from "./JourneyRoute";
import styles from "./journey.module.css";
import {
  type CheckpointId,
} from "./journey-config";

export default function JourneyScene({
  arrival,
}: {
  arrival: { point: CheckpointId; count: number } | null;
}) {
  const desktop = getImageProps({
    src: "/journey-preview/desktop-transparent.webp",
    alt: "",
    width: 1672,
    height: 941,
    sizes: "(max-width: 1099px) 1320px, 100vw",
    loading: "eager",
  }).props;
  return (
    <div
      className={styles.scene}
      role="group"
      aria-label="Mountain with an illuminated winding route to the summit"
    >
      <JourneySky />
      <picture>
        {/* Every viewport crops the same artwork and animation coordinate space together. */}
        <img {...desktop} alt="" className={styles.artwork} />
      </picture>
      <JourneyRoute arrival={arrival} />
    </div>
  );
}
