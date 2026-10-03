"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { LoaderCircle, Trash2 } from "lucide-react";
import { createHoldConfirm } from "@/lib/hold-confirm";

export default function HoldDeleteButton({ label, disabled, onConfirm, compact = false }: {
  label: string; disabled?: boolean; onConfirm: () => Promise<void>; compact?: boolean;
}) {
  const [holding, setHolding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const progress = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const pendingRef = useRef(false);
  const confirmRef = useRef(onConfirm);
  const controller = useRef<ReturnType<typeof createHoldConfirm> | null>(null);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => { confirmRef.current = onConfirm; }, [onConfirm]);
  function cancel() {
    controller.current?.cancel(); animation.current?.stop(); progress.set(0); setHolding(false);
  }
  useEffect(() => {
    const reset = () => { controller.current?.cancel(); animation.current?.stop(); progress.set(0); setHolding(false); };
    const visibilityChanged = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibilityChanged);
      controller.current?.cancel(); animation.current?.stop();
    };
  }, [progress]);
  useEffect(() => { if (disabled) { controller.current?.cancel(); animation.current?.stop(); progress.set(0); } }, [disabled, progress]);
  function start() {
    if (disabled || pendingRef.current || holding) return;
    setError("");
    controller.current ??= createHoldConfirm((done, duration) => { const timer = setTimeout(done, duration); return () => clearTimeout(timer); }, () => {
      animation.current?.stop(); progress.set(1); setHolding(false);
      pendingRef.current = true; setPending(true);
      void confirmRef.current().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete. Try again.")).finally(() => {
        pendingRef.current = false; setPending(false); progress.set(0);
      });
    });
    if (controller.current.start()) { setHolding(true); animation.current = animate(progress, 1, { duration: 1.2, ease: "linear" }); }
  }
  return <div className={compact ? "shrink-0" : "flex-1"}>
    <button type="button" disabled={disabled || pending} aria-label={`Hold to delete ${label}`} title="Hold for 1.2 seconds to delete. Release to cancel." className={`relative flex touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-xl border border-red-400/20 bg-red-400/5 text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-40 ${compact ? "size-11" : "h-12 w-full px-3 text-sm font-medium"}`}
      onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); start(); }}
      onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onLostPointerCapture={cancel} onBlur={cancel}
      onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel(); }}
      onKeyDown={(event) => { if (event.key === "Escape") cancel(); if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) start(); } }}
      onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); cancel(); } }}>
      <motion.span aria-hidden className="absolute inset-0 origin-left bg-red-500/35" style={{ scaleX: reduceMotion ? holding ? 1 : 0 : progress }} />
      <span className="relative">{pending ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}</span>
      {!compact && <span className="relative">{pending ? "Deleting…" : holding ? "Keep holding…" : "Hold to delete"}</span>}
    </button>
    {error && <p role="alert" className="mt-2 max-w-56 text-xs text-red-300">{error}</p>}
  </div>;
}
