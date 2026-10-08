"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";

export function FinanceViewLoader({ label }: { label: string }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-72 items-center justify-center rounded-3xl border border-border bg-card/30" style={{ height: "var(--finance-view-height, 20rem)" }}>
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" />
      <span>Loading {label}…</span>
    </div>
  </div>;
}

export default function FinanceViewTransition({ view, children }: { view: string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!content.current) return;
    let active = true;
    // Measure the active view, including lazy content and expandable fields.
    // Keep the last height while its replacement is loading.
    const observer = new ResizeObserver(([entry]) => {
      if (!active) return;
      const next = Math.ceil(entry.contentRect.height);
      if (next > 0) setHeight(previous => previous === next ? previous : next);
    });
    observer.observe(content.current);
    return () => { active = false; observer.disconnect(); };
  }, [view]);

  return <motion.div
    data-finance-view-transition
    initial={false}
    animate={{ height: height ?? "auto" }}
    transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeInOut" }}
    className="relative min-w-0 overflow-clip"
    style={{ "--finance-view-height": height === null ? undefined : `${height}px` } as CSSProperties}
  >
    <motion.div key={view} ref={content} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
      {children}
    </motion.div>
  </motion.div>;
}
