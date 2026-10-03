"use client";

import type { CSSProperties } from "react";

const chartPresets = [
  { name: "Steady climb", path: "M32 134L80 117L116 124L168 90L208 101L288 59", end: 59 },
  { name: "Small steps", path: "M32 134H77V119H125V104H176V82H230V66H288", end: 66 },
  { name: "Rolling progress", path: "M32 134C55 134 62 101 88 106S123 138 150 111S190 69 217 82S255 85 288 56", end: 56 },
  { name: "New direction", path: "M32 126L72 133L112 106L152 117L194 79L235 93L288 60", end: 60 },
  { name: "Building momentum", path: "M32 134C88 134 117 129 152 111S199 104 224 84S255 64 288 52", end: 52 },
] as const;

let nextPreset: number | null = null;
function startAnimation(node: HTMLDivElement | null) {
  if (!node) return;
  // Set the decorative phase after hydration, keeping server/client markup equal.
  const preset = nextPreset ?? Math.floor(Math.random() * chartPresets.length);
  nextPreset = (preset + 1) % chartPresets.length;
  node.style.setProperty("--momentum-loader-phase", `${-preset * 4}s`);
}

export default function AppLoading({ label = "Loading…" }: { label?: string }) {
  return <div ref={startAnimation} role="status" aria-live="polite" className="momentum-loader flex min-h-80 flex-col items-center justify-center gap-5 px-4 py-10">
    {/* Decorative motion, not a percentage or a chart of the user's results. */}
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 160" className="w-full max-w-80 overflow-visible">
      <path d="M32 62H288M32 98H288M32 134H288M80 55V142M144 55V142M208 55V142M272 55V142" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 6" />
      {chartPresets.map((preset, index) => <g key={preset.name} className="momentum-loader-plot" data-preset={preset.name} style={{ "--plot-offset": `${index === 0 ? 0 : (index - chartPresets.length) * 4}s` } as CSSProperties}>
        <path d={`${preset.path}V142H32Z`} fill="var(--primary-plus)" opacity="0.035" />
        <path d={preset.path} fill="none" stroke="var(--primary-plus)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.12" />
        <path d={preset.path} className="momentum-loader-line" pathLength="100" fill="none" stroke="var(--primary-plus)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle className="momentum-loader-endpoint" cx="288" cy={preset.end} r="3" fill="var(--primary-minus)" />
      </g>)}
      <g className="momentum-loader-compass" transform="translate(32 27)">
        <circle r="23" fill="var(--primary-plus)" opacity="0.055" />
        <circle r="17" fill="var(--background)" stroke="var(--primary-plus)" strokeWidth="1.5" />
        <g className="momentum-loader-needle">
          <path d="M0-12V-10M12 0H10M0 12V10M-12 0H-10" stroke="var(--primary-plus)" strokeWidth="1" opacity="0.5" />
          <path d="M7-7L3 3L-7 7L-3-3Z" fill="var(--primary-plus)" />
          <path d="M7-7L3 3L-3-3Z" fill="var(--primary-minus)" />
          <circle r="1.75" fill="var(--background)" />
        </g>
      </g>
    </svg>
    <div className="space-y-2 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">One useful step at a time.</p>
    </div>
  </div>;
}
