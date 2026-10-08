"use client";

import { useRef, useState } from "react";
import { sameTodoBoard, type TodoBoard, type TodoSaveResult } from "@/lib/todo";

export function useTodoBoard(initial: TodoBoard, save: (next: TodoBoard, previous: TodoBoard) => Promise<TodoSaveResult>) {
  const [data, setData] = useState(initial), [saving, setSaving] = useState(false), [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const current = useRef(initial), saved = useRef(initial), busy = useRef(false);
  const failed = useRef<{ next: TodoBoard; previous: TodoBoard } | null>(null);
  async function persist(next: TodoBoard, previous: TodoBoard): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    failed.current = null;
    setError("");
    current.current = next; setData(next); setSaving(true); setStatus("Saving");
    try {
      const result = await save(next, previous);
      if (!result.success) {
        if (result.conflict && result.data) { saved.current = result.data; current.current = result.data; setData(result.data); }
        const error = new Error(result.message || "Changes could not be saved.");
        if (result.conflict) Object.assign(error, { conflict: true });
        throw error;
      }
      saved.current = result.data || next;
      current.current = saved.current; setData(saved.current); setStatus("Saved");
      return true;
    } catch (error) {
      current.current = saved.current; setData(saved.current); setStatus("Save failed — saved position restored");
      const conflict = error instanceof Error && "conflict" in error;
      const attempt = { next, previous };
      if (!conflict) failed.current = attempt;
      setError(conflict ? "This board changed elsewhere. The latest saved tasks have been restored." : "Changes could not be saved. The saved position has been restored.");
      return false;
    } finally { busy.current = false; setSaving(false); }
  }
  function commit(update: TodoBoard | ((board: TodoBoard) => TodoBoard)) {
    if (busy.current) return Promise.resolve(false);
    const next = typeof update === "function" ? update(current.current) : update;
    if (sameTodoBoard(current.current, next)) return Promise.resolve(true);
    return persist(next, saved.current);
  }
  const attempt = failed.current;
  const retry = () => attempt && failed.current === attempt ? persist(attempt.next, attempt.previous) : Promise.resolve(false);
  return { data, saving, status, error, canRetry: !!attempt, retry, current, busy, commit };
}
