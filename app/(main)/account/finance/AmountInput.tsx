"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { stepFinanceAmount } from "@/lib/finance-playground";

export default function AmountInput({ id, value, onChange, disabled, name, required, autoFocus }: {
  id: string; value: string; onChange: (value: string) => void; disabled?: boolean;
  name?: string; required?: boolean; autoFocus?: boolean;
}) {
  return <div className="finance-amount-control flex items-center rounded-2xl border border-border bg-card transition-shadow focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20">
    <input id={id} name={name} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} autoFocus={autoFocus} type="number" inputMode="decimal" min={required ? "0.01" : "0"} max="999999999999" step="0.01" placeholder="0.00" className="h-16 w-full min-w-0 rounded-l-2xl bg-transparent px-2 text-2xl sm:px-4 sm:text-3xl font-semibold tabular-nums outline-none disabled:opacity-50" onKeyDown={(event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onChange(stepFinanceAmount(value, event.key === "ArrowUp" ? 1 : -1)); }
    }} />
    <div className="flex shrink-0 gap-1 pr-2">
      <button type="button" disabled={disabled || Number(value) <= 0} aria-label="Decrease amount by 1" className="flex size-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:border-orange-400/50 hover:bg-orange-400/10 hover:text-orange-300 disabled:opacity-30" onClick={() => onChange(stepFinanceAmount(value, -1))}><ChevronDown size={19} /></button>
      <button type="button" disabled={disabled} aria-label="Increase amount by 1" className="flex size-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20" onClick={() => onChange(stepFinanceAmount(value, 1))}><ChevronUp size={19} /></button>
    </div>
  </div>;
}
