"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseFinanceCategoryPositions, type FinanceCategoryPositions } from "@/lib/finance-playground";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("finance-category-layout", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("finance-category-layout", callback);
  };
};

export function useFinanceCategoryLayout(userId: string, mobile: boolean) {
  const key = `finance-category-layout:${userId}:${mobile ? "mobile" : "desktop"}`;
  const stored = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) || "{}"; } catch { return "{}"; }
  }, () => "{}");
  const positions = useMemo(() => parseFinanceCategoryPositions(stored), [stored]);
  function savePositions(next: FinanceCategoryPositions) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("finance-category-layout"));
      return true;
    } catch { return false; }
  }
  return { positions, savePositions };
}
