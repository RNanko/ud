"use client";
import { useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, TrendingUp } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { searchStockCatalog, stockCatalog, type StockAsset } from "@/lib/stock-catalog";

export default function StockPicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (asset: StockAsset) => void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const listId = useId(), list = useRef<HTMLDivElement>(null);
  const selected = stockCatalog.find(asset => asset.symbol === value.trim().toUpperCase());
  const matches = searchStockCatalog(search);
  function choose(asset: StockAsset) { onChange(asset); setOpen(false); setSearch(""); }
  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
    <Popover.Trigger asChild><button type="button" role="combobox" aria-label="Stock or ETF" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" disabled={disabled} className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-2xl border border-orange-400/30 bg-orange-400/5 px-4 text-left text-sm hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"><TrendingUp size={17} className="shrink-0 text-orange-300" /><span className="min-w-0 flex-1 truncate">{selected ? `${selected.symbol} · ${selected.name}` : "Choose a stock or ETF"}</span><ChevronDown size={17} className="shrink-0 text-orange-300" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={8} collisionPadding={12} className="z-[70] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-24px)] rounded-2xl border border-orange-400/25 bg-background p-2 shadow-2xl">
      <div className="relative"><Search size={16} className="absolute left-3 top-4 text-orange-300" /><Input aria-label="Search stocks and ETFs" placeholder="Search ticker or company…" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>("[role=option]")?.focus(); } }} className="h-12 border-border bg-card pl-9 dark:border-border dark:bg-card" /></div>
      <p className="px-3 py-3 text-xs text-muted-foreground">Popular stocks & ETFs · USD quotes</p>
      <div ref={list} id={listId} role="listbox" aria-label="Stock and ETF tickers" className="max-h-[min(300px,40dvh)] overflow-y-auto overscroll-contain" onKeyDown={event => {
        const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=option]") || []);
        if (!options.length) return;
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (current + 1) % options.length : event.key === "ArrowUp" ? (current - 1 + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); options[next].focus(); }
      }}>
        {matches.map((asset, index) => <button key={asset.symbol} type="button" role="option" aria-selected={asset.symbol === selected?.symbol} tabIndex={asset.symbol === selected?.symbol || index === 0 ? 0 : -1} onClick={() => choose(asset)} className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-orange-400/10 focus-visible:bg-orange-400/10 focus-visible:outline-2 focus-visible:outline-orange-400"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-orange-200">{asset.symbol}</span><span className="block truncate text-xs text-muted-foreground">{asset.name}</span></span><span className="text-[10px] text-muted-foreground">{asset.type}</span>{asset.symbol === selected?.symbol && <Check size={16} className="text-orange-300" />}</button>)}
        {!matches.length && <p role="status" className="p-4 text-sm text-muted-foreground">No match. Enter your ticker and asset name below.</p>}
      </div>
      <button type="button" onClick={() => setOpen(false)} className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-border px-3 text-sm text-orange-300 hover:bg-orange-400/10">Enter a ticker manually</button>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
