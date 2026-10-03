"use client";

import { useEffect } from "react";
import { getGymData } from "@/lib/actions/gym.actions";
import type { GymData } from "@/lib/gym/types";
export function notifyGymChange() {
  window.dispatchEvent(new Event("gym-records-changed"));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("gym-records-changed");
    channel.postMessage("saved");
    channel.close();
  }
}
/** Refresh account records across routes and tabs, without replacing a draft being edited. */
export function useGymSync(onData: (data: GymData) => void, paused: boolean) {
  useEffect(() => {
    if (paused) return;
    let disposed = false,
      running = false;
    const refresh = async () => {
      if (disposed || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const data = await getGymData();
        if (!disposed) onData(data);
      } catch {/* Existing records stay visible; foreground mutations report save errors. */} finally {
        running = false;
      }
    };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("gym-records-changed");
    if (channel) channel.onmessage = () => {
      void refresh();
    };
    const trigger = () => {
      void refresh();
    };
    window.addEventListener("focus", trigger);
    window.addEventListener("gym-records-changed", trigger);
    document.addEventListener("visibilitychange", trigger);
    const timer = window.setInterval(trigger, 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      channel?.close();
      window.removeEventListener("focus", trigger);
      window.removeEventListener("gym-records-changed", trigger);
      document.removeEventListener("visibilitychange", trigger);
    };
  }, [onData, paused]);
}
