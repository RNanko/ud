"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Activity } from "@/lib/momentum/types";
import { dateLabel } from "@/lib/gym/dates";
import { Action, Empty, Panel, SourceLink } from "./MomentumUI";

export default function RecentWins({ wins, milestones }: { wins: Activity[]; milestones: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Panel label="Recent wins" className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">Recent wins</h3>
      <Action tone="blue" aria-expanded={open} aria-controls={id} aria-label={open ? "Hide recent wins" : "Show recent wins"} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"}{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Action>
    </div>
    {/* Unmount immediately on close; hidden results have no focusable links. */}
    <div id={id} hidden={!open}>
      {open && <div className="space-y-4">
        {wins.length ? wins.map(item => <div key={item.key} className="space-y-2 border-b pb-3 last:border-0">
          <p className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-primary-minus" /><span className="break-words">{item.title}</span></p>
          <p className="text-xs text-muted-foreground">{item.detail} · {item.date ? `${dateLabel(item.date)}${item.completedAt ? "" : " scheduled context"}` : "completion date unknown"}</p>
          <SourceLink activity={item}>Open result</SourceLink>
        </div>) : <Empty>There are no completed records to show yet. Choose a useful next step; missing logs do not tell the whole story.</Empty>}
        {milestones > 0 && <p className="flex items-center gap-2 text-xs text-primary-minus"><Sparkles size={14} />{milestones} confirmed chapter or review milestones · no points or rankings</p>}
      </div>}
    </div>
  </Panel>;
}
