import type { CSSProperties } from "react";
import styles from "./journey.module.css";

// Two identical tiles move right continuously. The left tile replaces the
// right tile at the loop seam; transparent scenery occludes stars naturally.
export default function JourneySky() {
  return <div className={styles.sky} aria-hidden="true">
    {([false, true] as const).map(mobile => <div key={String(mobile)} className={mobile ? styles.mobileSky : styles.desktopSky}>
      {[0, 1, 2].map(layer => <svg key={layer} className={styles.starLayer} viewBox={mobile ? "0 0 1240 956" : "0 0 3344 941"}>
        {[0, 1].map(tile => <g key={tile} transform={`translate(${tile * (mobile ? 620 : 1672)} 0)`}>{Array.from({ length: 32 }, (_, index) => {
          const seed = (index * 137 + layer * 79 + 31) % 997;
          const cx = (seed / 997) * (mobile ? 620 : 1672);
          const cy = 8 + (seed * 17) % (mobile ? 250 : 440);
          return <circle key={index} className={styles.star} cx={cx} cy={cy} r={mobile ? .7 + layer * .2 : .9 + layer * .35} fill="#ecf8ff" style={{ "--twinkle-duration": `${4 + seed % 7}s`, "--twinkle-delay": `${-(seed % 113) / 10}s` } as CSSProperties} />;
        })}</g>)}
      </svg>)}
    </div>)}
  </div>;
}
