"use client";
import { useAccountFormat } from "@/hooks/use-account-format";

import { useState } from "react";
import { Search, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, ArrowLeftRight, Trash2, Tag, ArrowDownUp, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { filterFinance, summarizeFinance, type FinanceEntry, type MoneyType } from "@/lib/finance";
import { financeCsv, financeCsvFilename } from "@/lib/finance-csv";
import FinanceSelect from "./FinanceSelect";

export default function FinanceHistory({ entries, busy, onEdit, onMove, onDelete }: {
  entries: FinanceEntry[]; busy: boolean; onEdit: (entry: FinanceEntry) => void;
  onMove: (entry: FinanceEntry, type: MoneyType) => void; onDelete: (entry: FinanceEntry) => void;
}) {
  const {formatAmount, formatFinanceDate}=useAccountFormat();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const categories = [...new Set(entries.map((row) => row.category || "Uncategorized"))].sort();
  const filtered = filterFinance(entries, { search, type, category }).sort((a, b) => sort === "largest"
    ? Number(b.amount) - Number(a.amount)
    : sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * 8, safePage * 8);
  const totals = summarizeFinance(filtered);
  const hasFilters = !!search || type !== "all" || category !== "";
  const reset = () => { setSearch(""); setType("all"); setCategory(""); setPage(1); };
  function downloadCsv() {
    if (busy || !filtered.length) return;
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([financeCsv(filtered)], { type: "text/csv;charset=utf-8" }));
      link = document.createElement("a");
      link.href = url; link.download = financeCsvFilename(filtered);
      document.body.appendChild(link); link.click();
    } catch { toast.error("Could not download CSV. Please try again."); }
    finally {
      link?.remove();
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  }
  return (
    <section className="space-y-4" aria-label="Transaction history">
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><SlidersHorizontal size={17} className="text-muted-foreground" /><h2 className="text-base font-semibold">Find a transaction</h2></div><div className="flex flex-wrap items-center gap-2">{hasFilters && <Button variant="ghost" className="h-11 text-xs" onClick={reset}>Reset filters</Button>}<Button variant="outline" disabled={busy || !filtered.length} onClick={downloadCsv} title="Download all matching transactions, including other pages" className="h-11 rounded-xl border-sky-400/30 text-sky-300 hover:bg-sky-400/10 hover:text-sky-200"><Download size={16} />Download CSV</Button></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1.2fr_1fr]">
          <div className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-4 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search transactions" aria-label="Search transactions" className="h-12 rounded-2xl bg-background pl-10 dark:bg-background dark:border-border" /></div>
          <FinanceSelect label="Filter transaction type" title="Transaction type" icon={ArrowLeftRight} value={type} onValueChange={(value) => { setType(value); setPage(1); }} options={[{ value: "all", label: "All types" }, { value: "-", label: "Spending", color: "bg-orange-400" }, { value: "+", label: "Revenue", color: "bg-sky-400" }]} />
          <FinanceSelect label="Filter category" title="Category" icon={Tag} value={category} onValueChange={(value) => { setCategory(value); setPage(1); }} options={[{ value: "", label: "All categories" }, ...categories.map((value) => ({ value, label: value }))]} />
          <FinanceSelect label="Sort transactions" title="Sort by" icon={ArrowDownUp} value={sort} onValueChange={(value) => { setSort(value); setPage(1); }} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "largest", label: "Largest amount" }]} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1"><p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}</p><p className="text-xs text-muted-foreground">Filtered net <span className="ml-1 font-medium text-foreground tabular-nums">{formatAmount(totals.balance)}</span></p></div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="hidden grid-cols-[2fr_1.1fr_1fr_44px] gap-4 border-b border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground md:grid"><span>Transaction</span><span>Date</span><span className="text-right">Amount</span><span className="sr-only">Actions</span></div>
        {rows.map((row) => <article key={row.id} className="grid grid-cols-[1fr_44px] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[2fr_1.1fr_1fr_44px] md:gap-4 md:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${row.type === "+" ? "bg-sky-400/10 text-sky-300" : "bg-orange-400/10 text-orange-300"}`}>{row.type === "+" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="min-w-0"><p className="text-sm font-medium wrap-anywhere">{row.subcategory || row.category || "Transaction"}</p><p className="mt-1 text-xs text-muted-foreground wrap-anywhere">{row.category || "Uncategorized"} · {row.type === "+" ? "Revenue" : "Spending"}</p>{row.comment && <p className="mt-1 text-xs text-muted-foreground wrap-anywhere">{row.comment}</p>}</div></div>
          <time dateTime={row.date} className="col-start-1 row-start-2 pl-13 text-xs text-muted-foreground md:col-auto md:row-auto md:pl-0">{formatFinanceDate(row.date)}</time>
          <p className={`col-start-1 row-start-3 pl-13 text-sm font-semibold tabular-nums md:col-auto md:row-auto md:pl-0 md:text-right ${row.type === "+" ? "text-sky-300" : "text-orange-300"}`}>{row.type === "+" ? "+" : "−"}{formatAmount(row.amount)}</p>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions for ${row.subcategory || row.category}`} className="col-start-2 row-start-1 size-11 self-start rounded-xl md:col-auto md:row-auto md:self-center"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onEdit(row)} className="min-h-11"><Pencil /> Edit transaction</DropdownMenuItem><DropdownMenuItem onSelect={() => onMove(row, row.type === "+" ? "-" : "+")} className="min-h-11"><ArrowLeftRight /> Move to {row.type === "+" ? "spending" : "revenue"}</DropdownMenuItem><DropdownMenuItem onSelect={() => onDelete(row)} className="min-h-11 text-red-400"><Trash2 /> Delete transaction</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </article>)}
        {!rows.length && <div className="p-10 text-center"><Search className="mx-auto text-muted-foreground" size={24} /><h3 className="mt-3 text-base font-medium">{hasFilters ? "No matching transactions" : "Your history starts here"}</h3><p className="mt-2 text-sm text-muted-foreground">{hasFilters ? "Try a different search or reset your filters." : "Add spending or revenue, or choose another period."}</p>{hasFilters && <Button variant="outline" onClick={reset} className="mt-4 h-11">Reset filters</Button>}</div>}
      </div>
      {filtered.length > 0 && <div className="flex items-center justify-between"><Button variant="outline" aria-label="Previous history page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="h-11"><ChevronLeft size={16} /><span className="hidden sm:inline">Previous</span></Button><p className="text-xs text-muted-foreground">Page {safePage} of {pages}</p><Button variant="outline" aria-label="Next history page" disabled={safePage === pages} onClick={() => setPage(safePage + 1)} className="h-11"><span className="hidden sm:inline">Next</span><ChevronRight size={16} /></Button></div>}
    </section>
  );
}



