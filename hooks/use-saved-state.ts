"use client";

import { useRef, useState, type SetStateAction } from "react";
import { createSaveQueue } from "@/lib/save-queue";

export function useSavedState<T>(
  initialData: T,
  save: (data: T) => Promise<{ success: boolean; message?: string }>,
) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const current = useRef(initialData);
  const [queue] = useState(() => createSaveQueue(async (snapshot: T) => {
    const result = await save(snapshot);
    if (!result.success) throw new Error(result.message || "Unable to save changes");
  }));

  function changeData(update: SetStateAction<T>) {
    const next = typeof update === "function"
      ? (update as (prev: T) => T)(current.current)
      : update;
    if (next === current.current) return;
    current.current = next;
    setData(next);
    persist(next);
  }

  function persist(snapshot: T) {
    setError("");
    void queue.enqueue(snapshot).catch(() => {
      setError("Changes could not be saved. Retry before leaving this page.");
    });
  }

  // Loading a different board must not itself write to the database.
  function loadData(next: T) {
    current.current = next;
    setData(next);
  }

  return { data, changeData, loadData, error, retry: () => persist(current.current), flush: queue.flush };
}
