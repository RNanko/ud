"use client";

import { useMemo, useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("finance-order", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("finance-order", callback);
  };
};

export function useFinanceOrder<T extends { id: string }>(entries: T[], userId: string, namespace = "finance-order") {
  const key = `${namespace}:${userId}`;
  const stored = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; }
  }, () => "[]");
  const rank = useMemo(() => {
    let ids: string[] = [];
    try {
      const value = JSON.parse(stored);
      if (Array.isArray(value)) ids = value.filter((id): id is string => typeof id === "string");
    } catch { /* Ignore unavailable or invalid device preferences. */ }
    return new Map(ids.map((id, index) => [id, index]));
  }, [stored]);
  function orderEntries(next: T[]) { return [...next].sort((a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1)); }
  const ordered = orderEntries(entries);
  function saveOrder(next: T[]) {
    try {
      localStorage.setItem(key, JSON.stringify(next.map((entry) => entry.id)));
      window.dispatchEvent(new Event("finance-order"));
      return true;
    } catch { return false; }
  }
  return { ordered, saveOrder, orderEntries };
}
