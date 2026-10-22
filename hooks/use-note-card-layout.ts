"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NOTE_GRID, noteRowSpan } from "@/lib/notes/layout";

export function useNoteCardLayout() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>(NOTE_GRID.minimumHeight);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => {
      const next = card.getBoundingClientRect().height;
      setHeight(old => old === next ? old : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    measure();
    return () => observer.disconnect();
  }, []);

  return {
    cardRef, height,
    slotStyle: { "--note-rows": noteRowSpan(height) } as CSSProperties,
  };
}
