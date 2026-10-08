"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAccountCalendar } from "./use-account-calendar";
import { getMomentumBundle, mutateMomentum } from "@/lib/actions/momentum.actions";
import type { MomentumBundle } from "@/lib/momentum/types";
import type { MomentumCommand } from "@/lib/momentum/validation";
export function notifyMomentum() {
  window.dispatchEvent(new Event("momentum-changed"));
  try { localStorage.setItem("momentum-signal", String(Date.now())); } catch {}
}
export function useMomentum() {
  const {timezone}=useAccountCalendar();
  const [bundle, setBundle] = useState<MomentumBundle | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("Loading Momentum…"), [celebration, setCelebration] = useState(false);
  const current = useRef(bundle), lock = useRef(false), request = useRef<Parameters<typeof mutateMomentum>[0] | null>(null), epoch = useRef(0);
  const mounted = useRef(false), failed = useRef(false);
  const reload = useCallback(async () => {
    if (lock.current || request.current) return;
    const token = ++epoch.current;
    try {
      const next = await getMomentumBundle({ timezone });
      if (!mounted.current || token !== epoch.current || lock.current) return;
      current.current = next; setBundle(next);
      // Background refreshes must not erase an unresolved form-save rejection.
      if (!failed.current) { setError(""); setStatus("Saved to your account"); }
    } catch { if (mounted.current && token === epoch.current) { failed.current = true; setError("Momentum could not be loaded. Retry to see your saved records."); setStatus("Load failed — retry"); } }
    finally { if (mounted.current && token === epoch.current) setLoading(false); }
  }, [timezone]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    const signal = (event: StorageEvent) => { if (event.key === "momentum-signal" || event.key === "gym-data-changed") refresh(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); window.addEventListener("momentum-changed", refresh); window.addEventListener("storage", signal); document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("momentum-changed", refresh); window.removeEventListener("storage", signal); document.removeEventListener("visibilitychange", refresh); };
  }, [reload]);
  async function persist(command?: MomentumCommand) {
    if (lock.current || !current.current) return false;
    if (!command && !request.current) { await reload(); return false; }
    if (request.current && command) { setError("Retry the previous save first, or reload saved data before making another change."); return false; }
    const payload = request.current ?? { revision: current.current.record.revision, mutationId: crypto.randomUUID(), timezone, command: command! };
    request.current = payload;
    lock.current = true; ++epoch.current; setBusy(true); setError(""); setStatus("Saving…");
    let success = false;
    try {
      const result = await mutateMomentum(payload);
      if (!result.success) {
        if ("conflict" in result && result.conflict && result.record) {
          current.current = { ...current.current, record: result.record }; setBundle(current.current); request.current = null;
        } else request.current = "retryable" in result && result.retryable === false ? null : payload;
        throw new Error(result.message);
      }
      failed.current = false; request.current = null; current.current = { ...current.current, record: result.record, goalEvaluations: undefined }; setBundle(current.current); setStatus("Saved to your account");
      if (result.newAwards.length && result.record.data.preferences.rewards) setCelebration(true);
      success = true; notifyMomentum();
    } catch (reason) { failed.current = true; const message = reason instanceof Error ? reason.message : "Save failed — retry"; setError(message); setStatus("Save failed — retry"); }
    finally { lock.current = false; setBusy(false); }
    if (success) void reload();
    return success;
  }
  async function external(job: () => Promise<{ success: boolean; message?: string }>) {
    if (lock.current || request.current) return false;
    lock.current = true; ++epoch.current; setBusy(true); setError(""); setStatus("Saving…");
    let success = false;
    try { const result = await job(); if (!result.success) throw new Error(result.message || "Save failed — retry"); failed.current = false; success = true; setStatus("Saved to your account"); notifyMomentum(); }
    catch (reason) { failed.current = true; const message = reason instanceof Error ? reason.message : "Save failed — retry"; setError(message); setStatus("Save failed — retry"); }
    finally { lock.current = false; setBusy(false); }
    if (success) await reload();
    return success;
  }
  return { bundle, busy, loading, error, status, celebration, dismissCelebration: () => setCelebration(false), save: persist, retry: () => { if (!request.current) failed.current = false; return persist(); }, reload: async () => { request.current = null; failed.current = false; await reload(); }, external };
}
