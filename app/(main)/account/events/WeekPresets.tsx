"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  getNamedWeekPresets,
  saveNamedWeekPreset,
  removeNamedWeekPreset,
  type NamedWeekPreset,
} from "@/lib/actions/planner.actions";
import type { EventItems } from "@/types/types";
import { Confirm, Field, GymButton, GymDialog } from "../gym/GymUI";

export default function WeekPresets({ mode, week, board, onApply, onClose }: {
  mode: "save" | "apply";
  week: string;
  board: EventItems[];
  onApply: (board: EventItems[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<NamedWeekPreset[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [remove, setRemove] = useState<NamedWeekPreset | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    let valid = true;
    getNamedWeekPresets().then(value => {
      if (valid) { setItems(value); setError(""); }
    }).catch(() => {
      if (valid) setError("Presets could not be loaded. Please retry.");
    });
    return () => { valid = false; };
  }, [reload]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items || locked.current || items.length >= 3 || !name.trim()) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveNamedWeekPreset({ id, name: name.trim(), week, board, before: items });
      if (!result.success) throw new Error(result.message);
      setItems(result.data);
      setMessage(`Saved “${name.trim()}”.`);
      setName("");
      setId(crypto.randomUUID());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <>
    <GymDialog open title={mode === "save" ? "Save week preset" : "Your week presets"}
      description={mode === "save" ? "Name this week’s plans to use them again. Save up to three presets." : "Choose a saved week to apply its plans."}
      onClose={() => { if (!locked.current) onClose(); }}>
      {!items && !error && <p role="status">Loading presets…</p>}
      {items && <div className="space-y-5">
        {mode === "save" && <form className="space-y-3" onSubmit={save}>
          <Field label="Preset name" placeholder="e.g. My usual week" required maxLength={80}
            disabled={busy || items.length >= 3} value={name} onChange={event => setName(event.target.value)} />
          <GymButton type="submit" tone="blue" disabled={busy || items.length >= 3 || !name.trim()}>
            {busy ? "Saving…" : "Save preset"}
          </GymButton>
          {items.length >= 3 && <p className="text-sm text-muted-foreground">All three slots are used. Remove a saved preset to make room.</p>}
        </form>}
        {message && <p role="status" className="text-sm text-primary">{message}</p>}
        <section aria-label="Saved week presets" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Saved presets</h3>
            <span className="text-xs text-muted-foreground">{items.length} / 3</span>
          </div>
          {!items.length && <p className="text-sm text-muted-foreground">No saved presets yet.</p>}
          {items.map(item => {
            const count = item.board.reduce((sum, day) => sum + day.tasks.length, 0);
            return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/30 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium wrap-anywhere">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{count} {count === 1 ? "plan" : "plans"}</p>
              </div>
              {mode === "apply" && <GymButton tone="blue" aria-label={`Use week preset ${item.name}`} disabled={busy}
                onClick={() => onApply(item.board as EventItems[])}>Use preset</GymButton>}
              <GymButton aria-label={`Remove week preset ${item.name}`} disabled={busy}
                className="text-muted-foreground hover:text-orange-300" onClick={() => setRemove(item)}>
                <Trash2 size={16} aria-hidden="true" />Remove
              </GymButton>
            </div>;
          })}
        </section>
      </div>}
      {error && <div role="alert" className="space-y-2">
        <p className="text-sm gym-error">{error}</p>
        <GymButton disabled={busy} onClick={() => { setError(""); setReload(value => value + 1); }}>Reload presets</GymButton>
      </div>}
    </GymDialog>
    {remove && <Confirm title={`Remove “${remove.name}”?`}
      description="Removes only this saved preset. Scheduled events and workouts stay in your calendar."
      onClose={() => setRemove(null)} onConfirm={async () => {
        if (!items || locked.current) return;
        locked.current = true;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const result = await removeNamedWeekPreset({ id: remove.id, before: items });
          if (!result.success) throw new Error(result.message);
          setItems(result.data);
          setMessage(`Removed “${remove.name}”.`);
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }} />}
  </>;
}
