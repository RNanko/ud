import { useId } from "react";
import styles from "./journey.module.css";
import type { CheckpointId } from "./journey-config";

const desktopPath =
  "M 1380 680 C 1370 648 1290 639 1290 619 C 1290 590 1150 554 1131 520 C 1090 482 1208 460 1290 438 C 1370 420 1335 388 1288 362 C 1237 346 1160 340 1203 299 C 1230 272 1300 202 1327 207 C 1350 176 1260 179 1289 158 C 1320 136 1298 120 1293 107";
// Traced against the cleaned mobile crop (620 × 956), whose reconstructed
// route differs slightly in the areas formerly hidden by the painted cards.
const mobilePath =
  "M 440 950 C 475 920 475 875 435 850 C 390 815 210 798 180 765 C 145 730 225 691 285 657 C 326 630 269 603 283 576 C 294 540 387 535 374 499 C 365 461 245 451 240 420 C 233 396 294 384 305 354 C 322 323 269 305 259 280 C 249 258 330 248 322 229 C 317 214 290 214 298 200 L 298 85";

// Feedback uses the same traced road, beginning near the chosen checkpoint.
const startOffset = { footpath: -10, ridge: -28, ascent: -60 };
export default function JourneyRoute({
  arrival,
}: {
  arrival: { point: CheckpointId; count: number } | null;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <>
      <svg
        className={`${styles.route} ${styles.desktopRoute}`}
        viewBox="0 0 1672 941"
        aria-hidden="true"
      >

        <path
          className={styles.energy}
          d={desktopPath}
          pathLength="100"
          mask={`url(#${id}-road)`}
        />
        {arrival && (
          <path
            key={arrival.count}
            className={styles.arrivalLine}
            d={desktopPath}
            pathLength="100"
            mask={`url(#${id}-road)`}
            style={
              {
                "--start-offset": startOffset[arrival.point],
              } as React.CSSProperties
            }
          />
        )}
        <circle className={styles.beacon} cx="1293" cy="107" r="9" />
      </svg>
      <svg
        className={`${styles.route} ${styles.mobileRoute}`}
        viewBox="0 0 620 956"
        aria-hidden="true"
      >
        <path className={styles.energy} d={mobilePath} pathLength="100" />
        {arrival && (
          <path
            key={arrival.count}
            className={styles.arrivalLine}
            d={mobilePath}
            pathLength="100"
            style={
              {
                "--start-offset": startOffset[arrival.point],
              } as React.CSSProperties
            }
          />
        )}
        <circle className={styles.beacon} cx="298" cy="85" r="8" />
      </svg>
    </>
  );
}
