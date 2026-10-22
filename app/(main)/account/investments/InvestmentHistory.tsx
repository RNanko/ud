"use client";

import { useState } from "react";
import { Bitcoin, TrendingUp, ChevronLeft, ChevronRight, Pencil, RotateCcw, Search } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAccountFormat } from "@/hooks/use-account-format";
import { summarizeInvestments, type InvestmentPosition, type ValuedPosition } from "@/lib/investments";
import HoldDeleteButton from "../finance/HoldDeleteButton";

export default function InvestmentHistory({ rows, busy, filtered, onEdit, onRemove, onRestore, onReset }: {
  rows: ValuedPosition[]; busy: boolean; filtered: boolean;
  onEdit: (position: InvestmentPosition) => void;
  onRemove: (position: InvestmentPosition) => Promise<void>;
  onRestore: (position: InvestmentPosition) => Promise<void>;
  onReset: () => void;
}) {
  const { investmentMoney, investmentQuantity, formatFinanceDate } = useAccountFormat();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 8)), safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * 8, safePage * 8), totals = summarizeInvestments(rows);
  return <section className="space-y-4" aria-label="Investment position history">
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div><h2 className="text-lg font-semibold">Position history</h2><p className="mt-1 text-xs text-muted-foreground">{rows.length} saved {rows.length === 1 ? "record" : "records"} · {rows.filter(row => !row.position.archived).length} active</p></div>
      <p className="text-xs text-muted-foreground">Active unrealized P/L <span className={`ml-1 font-medium tabular-nums ${totals.profit === null ? "" : totals.profit < 0 ? "text-[#ff8098]" : "text-[#70ff9b]"}`}>{totals.profit !== null && totals.profit >= 0 ? "+" : ""}{investmentMoney(totals.profit)}</span></p>
    </div>
    <p className="px-1 text-xs text-muted-foreground">Saved positions, including archived records. Profit uses current prices for active positions; exit prices and realized profit are not recorded.</p>
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="hidden grid-cols-[1.6fr_1fr_.7fr_1fr_1.1fr_96px] gap-3 border-b border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground md:grid">
        <span>Position</span><span>Purchase date</span><span className="text-right">Quantity</span><span className="text-right">Purchase cost</span><span className="text-right">Unrealized P/L</span><span className="sr-only">Actions</span>
      </div>
      {visible.map(row => {
        const { position } = row, archived = !!position.archived, crypto = position.kind === "crypto";
        return <article key={position.id} aria-label={`${position.symbol} ${archived ? "archived" : "active"} position`} className="grid grid-cols-[1fr_44px] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1.6fr_1fr_.7fr_1fr_1.1fr_96px] md:gap-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${crypto ? "bg-sky-400/10 text-sky-300" : "bg-orange-400/10 text-orange-300"}`}>{crypto ? <Bitcoin size={18} /> : <TrendingUp size={18} />}</span><div className="min-w-0"><p className="text-sm font-medium wrap-anywhere">{position.symbol}</p><p className="mt-1 text-xs text-muted-foreground wrap-anywhere">{position.name}</p><p className={`mt-1 text-[10px] ${archived ? "text-muted-foreground" : "text-primary"}`}>{archived ? "Archived" : "Active"} · {position.currency ?? "USD"}</p></div></div>
          <time dateTime={position.boughtOn} className="col-start-1 row-start-2 pl-13 text-xs text-muted-foreground md:col-auto md:row-auto md:pl-0">{formatFinanceDate(position.boughtOn)}</time>
          <p className="col-start-1 row-start-3 pl-13 text-xs tabular-nums md:col-auto md:row-auto md:pl-0 md:text-right"><span className="text-muted-foreground md:hidden">Quantity </span>{investmentQuantity(position.quantity)}</p>
          <div className="col-start-1 row-start-4 pl-13 text-xs md:col-auto md:row-auto md:pl-0 md:text-right"><p className="font-medium tabular-nums"><span className="font-normal text-muted-foreground md:hidden">Cost </span>{row.supported ? investmentMoney(row.cost) : `${position.currency} ${row.cost}`}</p><p className="mt-1 text-[10px] text-muted-foreground tabular-nums">{row.supported ? investmentMoney(Number(position.buyPrice)) : `${position.currency} ${position.buyPrice}`} / unit</p></div>
          <div className={`col-start-1 row-start-5 pl-13 text-xs md:col-auto md:row-auto md:pl-0 md:text-right ${row.profit === null ? "text-muted-foreground" : row.profit < 0 ? "text-[#ff8098]" : "text-[#70ff9b]"}`}><p className="font-semibold tabular-nums"><span className="font-normal text-muted-foreground md:hidden">P/L </span>{row.profit !== null && row.profit >= 0 ? "+" : ""}{investmentMoney(row.profit)}</p><p className="mt-1 text-[10px]">{archived ? "Not recorded" : row.percent === null ? "Price unavailable" : `${row.percent >= 0 ? "+" : ""}${row.percent.toFixed(2)}%`}</p></div>
          <div className="col-start-2 row-span-5 row-start-1 flex flex-col items-end gap-2 self-start md:col-auto md:row-span-1 md:row-auto md:flex-row md:items-center md:self-center [&>div]:max-w-11 [&_p]:wrap-anywhere">
            {archived ? <Button variant="ghost" size="icon" disabled={busy} onClick={() => { void onRestore(position).catch(() => {}); }} aria-label={`Restore ${position.symbol} position`} title="Restore position" className="size-11 shrink-0 rounded-xl"><RotateCcw size={17} /></Button> : <><Button variant="ghost" size="icon" disabled={busy || !row.supported} onClick={() => onEdit(position)} aria-label={`Edit ${position.symbol} position`} title="Edit position" className="size-11 shrink-0 rounded-xl"><Pencil size={17} /></Button><HoldDeleteButton compact label={`${position.symbol} position`} disabled={busy} onConfirm={() => onRemove(position)} /></>}
          </div>
        </article>;
      })}
      {!visible.length && <div className="p-10 text-center"><Search className="mx-auto text-muted-foreground" size={24} /><h3 className="mt-3 text-base font-medium">{filtered ? "No matching positions" : "Your history starts here"}</h3><p className="mt-2 text-sm text-muted-foreground">{filtered ? "Try another period or reset your filters." : "Add a stock, ETF or crypto position to start."}</p>{filtered && <Button variant="outline" onClick={onReset} className="mt-4 h-11">Reset filters</Button>}</div>}
    </div>
    {rows.length > 0 && <div className="flex items-center justify-between"><Button variant="outline" aria-label="Previous investment history page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="h-11"><ChevronLeft size={16} /><span className="hidden sm:inline">Previous</span></Button><p className="text-xs text-muted-foreground">Page {safePage} of {pages}</p><Button variant="outline" aria-label="Next investment history page" disabled={safePage === pages} onClick={() => setPage(safePage + 1)} className="h-11"><span className="hidden sm:inline">Next</span><ChevronRight size={16} /></Button></div>}
  </section>;
}
