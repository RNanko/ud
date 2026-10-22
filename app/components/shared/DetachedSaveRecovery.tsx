"use client";

import { useState, useSyncExternalStore } from "react";
import { getDetachedSaves, subscribeDetachedSaves, type DetachedSave } from "@/lib/background-save-queue";
import BackgroundSaveStatus from "./BackgroundSaveStatus";
import { Button } from "@/app/components/ui/button";

const empty: DetachedSave[] = [];
export default function DetachedSaveRecovery({ owner }: { owner: string }) {
  const saves = useSyncExternalStore(subscribeDetachedSaves, getDetachedSaves, () => empty);
  const [notice, setNotice] = useState("");
  const owned = saves.filter(save => save.owner === owner);
  if (!owned.length && !notice) return null;
  return <aside aria-label="Background save recovery" className="mb-4 space-y-2">
    {owned.map(save => <BackgroundSaveStatus key={save.id} count={1} failure={save.failure}
      onRetry={() => { void save.retry().then(() => setNotice("Changes saved. Reopen the original page to see the latest version."), () => {}); }}
      onDiscard={() => { save.discard(); }} />)}
    {notice && <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm"><p className="flex-1">{notice}</p><Button variant="ghost" onClick={() => setNotice("")}>Dismiss</Button></div>}
  </aside>;
}
