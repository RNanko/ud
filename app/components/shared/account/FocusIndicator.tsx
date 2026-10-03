"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";
import { getMomentumFocus } from "@/lib/actions/momentum.actions";
import { elapsedFocus } from "@/lib/momentum/logic";
import type { Focus } from "@/lib/momentum/types";
export default function FocusIndicator() {
  const [focus, setFocus] = useState<Focus | null>(null), [now, setNow] = useState(0), [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = async () => { try { const saved = await getMomentumFocus(); if (live) { setFocus(saved); setNow(Date.now()); setError(false); } } catch { if (live) setError(true); } };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === "momentum-signal") visible(); };
    void refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000), poll = setInterval(visible, 30000);
    window.addEventListener("focus", visible); window.addEventListener("momentum-changed", visible); window.addEventListener("storage", storage); document.addEventListener("visibilitychange", visible);
    return () => { live = false; clearInterval(tick); clearInterval(poll); window.removeEventListener("focus", visible); window.removeEventListener("momentum-changed", visible); window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible); };
  }, []);
  if (!focus && !error) return null;
  const left = focus ? Math.max(0, focus.plannedSeconds - elapsedFocus(focus, now)) : 0;
  return <Link href="/account/momentum" className="momentum-focus-indicator flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-plus" aria-label={error ? "Focus status unavailable. Open Momentum to retry." : "Open current focus session"}><Timer size={17} /><span>{error ? "Focus unavailable · retry in Momentum" : !left || focus?.status === "awaiting" ? "Focus ready to review" : focus?.status === "paused" ? "Focus paused" : `Focus · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} remaining`}</span></Link>;
}
