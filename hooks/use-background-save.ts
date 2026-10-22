"use client";

import { useEffect, useState } from "react";
import { BackgroundSaveQueue } from "@/lib/background-save-queue";

export function useBackgroundSave<S, O, C>(initial: S, options: {
  reduce: (snapshot: S, input: O) => S;
  prepare: (snapshot: S, input: O) => C;
  save: (command: C) => Promise<S>;
  apply: (snapshot: S) => void;
  owner?: string;
}) {
  const [queue] = useState(() => new BackgroundSaveQueue<S, O, C>(initial, options));
  useEffect(() => { queue.configure(options); }, [queue, options]);
  const [, update] = useState(0);
  const { apply } = options;
  useEffect(() => queue.subscribe(() => {
    const next = queue.getState();
    apply(next.snapshot);
    update(value => value + 1);
  }), [queue, apply]);
  return { queue, ...queue.getState() };
}
