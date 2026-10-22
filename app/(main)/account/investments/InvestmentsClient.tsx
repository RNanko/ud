"use client";
import { useAccountFormat } from "@/hooks/use-account-format";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bitcoin,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Search,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Wallet,
  CircleDollarSign,
  LayoutDashboard,
  History,
  ListFilter,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  refreshInvestmentMarket,
  commitInvestment,
} from "@/lib/actions/investments.actions";
import {
  filterInvestments,
  summarizeInvestments,
  summarizeInvestmentRecords,
  valuePosition,
  type InvestmentDraft,
  type InvestmentKind,
  type InvestmentMarket,
  type InvestmentPosition,
  type ValuedPosition,
} from "@/lib/investments";
import FinanceSelect from "../finance/FinanceSelect";
import InvestmentEditor from "./InvestmentEditor";
import InvestmentCharts from "./InvestmentCharts";
import InvestmentHistory from "./InvestmentHistory";
import ChartDatePicker from "@/app/components/shared/charts/ChartDatePicker";
import { useMoneyMutation } from "@/hooks/use-money-mutation";
import type { InvestmentCommand, InvestmentSnapshot } from "@/lib/money/types";
import MoneyRecovery from "@/app/components/shared/MoneyRecovery";

const profitColor = (value: number | null) =>
  value === null
    ? "text-muted-foreground"
    : value >= 0
      ? "text-[#70ff9b]"
      : "text-[#ff8098]";
const percent = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const timeLabel = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Awaiting a quote";
export default function InvestmentsClient({
  initialPositions,
  initialRevision,
  initialMarket,
}: {
  initialPositions: InvestmentPosition[];
  initialRevision: number;
  initialMarket: InvestmentMarket;
}) {
  const { investmentMoney } = useAccountFormat();
  const [positions, setPositions] = useState(initialPositions);
  const [marketOverride, setMarketOverride] = useState<{ source: InvestmentMarket; value: InvestmentMarket } | null>(null);
  const market = marketOverride?.source === initialMarket ? marketOverride.value : initialMarket;
  const [view, setView] = useState("dashboard");
  const [editor, setEditor] = useState<{
    kind: InvestmentKind;
    position: InvestmentPosition | null;
  } | null>(null);
  const [saving, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [refreshError, setRefreshError] = useState("");
  const lock = useRef(false),
    refreshVersion = useRef(0);
  const [removed, setRemoved] = useState<InvestmentPosition | null>(null);
  const [actionError, setActionError] = useState("");
  const mutation = useMoneyMutation<InvestmentCommand["data"], InvestmentSnapshot>(initialRevision, commitInvestment, snapshot => setPositions(snapshot.positions));
  const busy = saving || !!mutation.pending;
  const pendingData = mutation.pending?.command.data;
  const latestPosition = pendingData ? mutation.pending?.latest?.positions.find(position => position.id === pendingData.id) : undefined;
  const describePosition = (position: InvestmentDraft | InvestmentPosition) => [position.name, position.symbol, position.currency || "USD", `Buy price ${position.buyPrice}`, `Quantity ${position.quantity}`, position.boughtOn, position.manualPrice ? `Valuation ${position.manualPrice}` : "Market valuation"].join(" · ");
  const recovery = mutation.pending && pendingData ? <MoneyRecovery status={mutation.pending.status} message={mutation.pending.message}
    draft={pendingData.kind === "position" ? describePosition(pendingData.position) : pendingData.archived ? "Remove this position" : "Restore this position"}
    latest={latestPosition ? `${describePosition(latestPosition)}${latestPosition.archived ? " · Removed from portfolio" : ""}` : pendingData.kind === "position" && pendingData.create ? "The portfolio changed elsewhere. This is a new position." : "This position was deleted. It cannot be restored by this edit."}
    canRetry={mutation.pending.status !== "conflict" || pendingData.kind === "position" && pendingData.create || !!latestPosition && (pendingData.kind === "archive" || !latestPosition.archived)}
    onRetry={() => { void mutation.retry().then(snapshot => { if(snapshot) { setEditor(null); setRemoved(null); setActionError(""); void refresh(); } }).catch(() => {}); }}
    onDiscard={() => { mutation.discard(); setEditor(null); setActionError(""); }} /> : null;
  const [filters, setFilters] = useState({
    search: "",
    kind: "all",
    performance: "all",
    from: "",
    to: "",
    sort: "newest",
    status: "all",
  });
  const reducedMotion = useReducedMotion();
  const allRows = positions.map((position) => valuePosition(position, market.quotes));
  const portfolioRows = allRows.filter(row => !row.position.archived);
  const historyRows = filterInvestments(allRows, filters);
  const rows = historyRows.filter(row => !row.position.archived);
  const totals = summarizeInvestments(rows);
  const cryptoRows = rows.filter((row) => row.position.kind === "crypto"),
    otherRows = rows.filter((row) => row.position.kind === "other");
  const cryptoCost = summarizeInvestments(cryptoRows).cost,
    cryptoShare = totals.cost ? (cryptoCost / totals.cost) * 100 : 0;
  const hasFilters =
    !!filters.search ||
    filters.kind !== "all" ||
    filters.performance !== "all" || filters.status !== "all" || filters.sort !== "newest" ||
    !!filters.from ||
    !!filters.to;
  const updateFilter = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ search: "", kind: "all", performance: "all", from: "", to: "", sort: "newest", status: "all" });
  function showHistory(kind: InvestmentKind) {
    setFilters(current => ({ ...current, kind }));
    setView("history");
  }
  async function refresh() {
    const version = ++refreshVersion.current;
    setRefreshing(true);
    setRefreshError("");
    try {
      const next = await refreshInvestmentMarket();
      if (version === refreshVersion.current) {
        if (next.ok) setMarketOverride({ source: initialMarket, value: next.value });
        else setRefreshError(next.error);
      }
    } catch {
      if (version === refreshVersion.current)
        setRefreshError(
          "Could not refresh prices. Previous quotes remain visible with their timestamps.",
        );
    } finally {
      if (version === refreshVersion.current) setRefreshing(false);
    }
  }
  async function save(id: string | null, draft: InvestmentDraft) {
    if (lock.current) throw new Error("Please wait for the current save");
    lock.current = true;
    setBusy(true);
    try {
      await mutation.run({kind: "position", id: id || crypto.randomUUID(), create: id === null, position: draft});
      void refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function archive(position: InvestmentPosition, archived: boolean) {
    if (lock.current) throw new Error("Please wait for the current save");
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await mutation.run({kind: "archive", id: position.id, archived});
      setRemoved(archived ? position : null);
      if (!archived) void refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not update this position.");
      throw reason;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Investment portfolio"
      className="investment-page mx-auto min-w-0 max-w-7xl space-y-5 pb-8"
    >
      {actionError && <p role="alert" className="rounded-2xl border border-orange-400/30 p-4 text-sm text-orange-300">{actionError}</p>}
      {!editor && recovery}
      {removed && <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4 text-sm">
        <p className="flex-1">{removed.name} removed from your portfolio.</p>
        <Button variant="outline" disabled={busy} onClick={() => { void archive(removed, false).catch(() => {}); }}>Undo</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setRemoved(null)}>Dismiss</Button>
      </div>}
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-sky-300">
            <ChartNoAxesCombined size={15} />
            Your future, in focus
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Investments
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every position. One clear picture.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={busy}
            className="h-12 rounded-xl bg-orange-400 text-orange-950 hover:bg-orange-300"
            onClick={() => setEditor({ kind: "other", position: null })}
          >
            <Plus size={17} />
            Add stock / ETF
          </Button>
          <Button
            disabled={busy}
            className="h-12 rounded-xl border border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20"
            onClick={() => setEditor({ kind: "crypto", position: null })}
          >
            <Plus size={17} />
            Add crypto
          </Button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Investment currency: USD · Investments currently support USD only.
      </p>
      {totals.unsupported > 0 && (
        <p role="status" className="text-sm">
          {totals.unsupported} legacy non-USD positions are preserved and
          excluded from USD totals. They need explicit migration.
        </p>
      )}
      <Tabs value={view} onValueChange={value => { setView(value); if (value === "charts") void refresh(); }} className="gap-5">
        <TabsList aria-label="Investment views" className="grid h-12 w-full grid-cols-3 rounded-2xl border border-border bg-card p-1 sm:w-96">
          <TabsTrigger value="dashboard" disabled={busy} className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm">
            <LayoutDashboard className="hidden sm:block" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="charts" disabled={busy} className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm">
            <ChartNoAxesCombined className="hidden sm:block" /> Charts
          </TabsTrigger>
          <TabsTrigger value="history" disabled={busy} className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm">
            <History className="hidden sm:block" /> History
          </TabsTrigger>
        </TabsList>
        {view !== "charts" && <div role="group" aria-label="Investment filters" className="min-w-0 rounded-2xl border border-border bg-card/40 p-3">
          <div className="relative flex items-center gap-2 overflow-x-auto pb-1">
            <div className="relative min-w-40 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" /><Input aria-label="Search investments" placeholder="Ticker or asset" value={filters.search} onChange={event => updateFilter("search", event.target.value)} className="h-11 rounded-xl bg-background pl-9 text-xs dark:bg-background dark:border-border" /></div>
            <div className="w-36 shrink-0"><FinanceSelect label="Filter investment type" title="Asset type" icon={ArrowLeftRight} value={filters.kind} onValueChange={value => updateFilter("kind", value)} className="min-h-11 rounded-xl px-3 text-xs" options={[{ value: "all", label: "All assets" }, { value: "other", label: "Stocks & ETFs", color: "bg-orange-400" }, { value: "crypto", label: "Crypto", color: "bg-sky-400" }]} /></div>
            <div className="w-32 shrink-0"><ChartDatePicker compact label="Start date" value={filters.from} maximum={filters.to} onChange={value => updateFilter("from", value)} /></div>
            <div className="w-32 shrink-0"><ChartDatePicker compact label="End date" value={filters.to} minimum={filters.from} onChange={value => updateFilter("to", value)} /></div>
            <div className="w-32 shrink-0"><FinanceSelect label="Filter performance" title="Unrealized P/L" icon={TrendingUp} value={filters.performance} onValueChange={value => updateFilter("performance", value)} className="min-h-11 rounded-xl px-3 text-xs" options={[{ value: "all", label: "All P/L" }, { value: "gain", label: "In profit", color: "bg-[#70ff9b]" }, { value: "loss", label: "At a loss", color: "bg-[#ff4466]" }, { value: "unpriced", label: "No P/L" }]} /></div>
            <div className="w-32 shrink-0"><FinanceSelect label="Filter position status" title="Position status" icon={ListFilter} value={filters.status} onValueChange={value => updateFilter("status", value)} className="min-h-11 rounded-xl px-3 text-xs" options={[{ value: "all", label: "All records" }, { value: "active", label: "Active", color: "bg-primary" }, { value: "archived", label: "Archived" }]} /></div>
            <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-xl" aria-label="Reset investment filters" title="Reset filters" disabled={!hasFilters} onClick={resetFilters}><RotateCcw size={16} /></Button>
          </div>
        </div>}
        <TabsContent value="dashboard" className="space-y-5">
        {view === "dashboard" && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Invested"
          value={investmentMoney(totals.cost)}
          note="Purchase cost · USD"
          color="orange"
          icon={<Wallet size={18} />}
        />
        <Stat
          label="Current value"
          value={investmentMoney(totals.value)}
          note={`${totals.priced} of ${totals.count} positions priced`}
          color="blue"
          icon={<CircleDollarSign size={18} />}
        />
        <Stat
          label="Unrealized profit / loss"
          value={
            totals.profit !== null
              ? `${totals.profit >= 0 ? "+" : ""}${investmentMoney(totals.profit)}`
              : "—"
          }
          note="Priced positions only"
          color={totals.profit !== null && totals.profit < 0 ? "red" : "green"}
          icon={
            totals.profit !== null && totals.profit < 0 ? (
              <TrendingDown size={18} />
            ) : (
              <TrendingUp size={18} />
            )
          }
        />
        <Stat
          label="Return"
          value={percent(totals.percent)}
          note="Against purchase cost"
          color={totals.profit !== null && totals.profit < 0 ? "red" : "green"}
          icon={<ChartNoAxesCombined size={18} />}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section
          className="rounded-3xl border border-border bg-card/25 p-5"
          aria-label="Investment allocation"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Where you’re invested</h2>
            <span className="text-xs text-muted-foreground">Purchase cost</span>
          </div>
          <div className="my-4 flex h-3 overflow-hidden rounded-full bg-muted">
            <motion.div
              animate={{ width: totals.cost ? `${100 - cryptoShare}%` : "0%" }}
              transition={{ duration: reducedMotion ? 0 : 0.4 }}
              className="h-full bg-orange-400"
            />
            <motion.div
              animate={{ width: `${cryptoShare}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.4 }}
              className="h-full bg-sky-400 shadow-[0_0_15px_#38bdf855]"
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-orange-300">
              ● Stocks & ETFs{" "}
              <span className="ml-2 text-foreground">
                {investmentMoney(totals.cost - cryptoCost)}
              </span>
            </span>
            <span className="text-sky-300">
              ● Crypto{" "}
              <span className="ml-2 text-foreground">
                {investmentMoney(cryptoCost)}
              </span>
            </span>
          </div>
        </section>
        <section
          className="flex items-center justify-between gap-3 rounded-3xl border border-sky-400/15 bg-sky-400/5 p-5"
          aria-label="Market prices"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span
                className={`size-2 rounded-full ${refreshError || market.warnings.length ? "bg-orange-400" : "bg-[#70ff9b] shadow-[0_0_8px_#70ff9b77]"}`}
              />
              {refreshing ? "Refreshing quotes…" : "Market snapshot"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {timeLabel(market.refreshedAt)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              USD · quotes may be delayed
            </p>
          </div>
          <Button
            variant="outline"
            disabled={refreshing || busy}
            onClick={() => {
              void refresh();
            }}
            aria-label="Refresh investment prices"
            className="size-12 shrink-0 rounded-2xl border-sky-400/25 dark:border-sky-400/25 bg-transparent dark:bg-transparent text-sky-300 dark:hover:bg-sky-400/10"
          >
            <RefreshCw
              size={19}
              className={
                refreshing ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
          </Button>
        </section>
      </div>
      {(refreshError || market.warnings.length > 0) && (
        <p
          role="status"
          className="rounded-2xl border border-orange-400/25 bg-orange-400/5 px-4 py-3 text-sm text-orange-200"
        >
          {refreshError || market.warnings.join(" ")}
        </p>
      )}
      {totals.priced < totals.count && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          {totals.count - totals.priced}{" "}
          {totals.count - totals.priced === 1 ? "position is" : "positions are"}{" "}
          awaiting a price. Value and return include priced positions only;
          invested cost includes all matching positions.
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <PortfolioWindow
          kind="other"
          rows={otherRows}
          busy={busy}
          filtered={hasFilters}
          onAdd={() => setEditor({ kind: "other", position: null })}
          records={historyRows.filter(row => row.position.kind === "other")}
          onHistory={() => showHistory("other")}
        />
        <PortfolioWindow
          kind="crypto"
          rows={cryptoRows}
          busy={busy}
          filtered={hasFilters}
          onAdd={() => setEditor({ kind: "crypto", position: null })}
          records={historyRows.filter(row => row.position.kind === "crypto")}
          onHistory={() => showHistory("crypto")}
        />
      </div>
      <footer className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Crypto quotes and the top 200 ticker list:{" "}
        <a
          href="https://www.coingecko.com"
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 hover:underline"
        >
          CoinGecko
        </a>
        . Stock/ETF quotes:{" "}
        <a
          href="https://finance.yahoo.com"
          target="_blank"
          rel="noreferrer"
          className="text-orange-300 hover:underline"
        >
          Yahoo Finance
        </a>
        .{" "}
        {market.catalogLive
          ? "Ticker ranking refreshed with prices."
          : `Saved ticker ranking from ${market.catalogAt.slice(0, 10)}.`}{" "}
        Returns exclude fees, taxes and dividends.
      </footer>
        </>}
        </TabsContent>
        <TabsContent value="charts">
          {view === "charts" && <InvestmentCharts rows={portfolioRows} refreshing={refreshing} disabled={busy} onRefresh={() => { void refresh(); }} updatedAt={timeLabel(market.refreshedAt)} error={refreshError} warnings={market.warnings} />}
        </TabsContent>
        <TabsContent value="history">
          {view === "history" && <InvestmentHistory key={JSON.stringify(filters)} rows={historyRows} busy={busy} filtered={hasFilters}
            onEdit={position => setEditor({ kind: position.kind, position })} onRemove={position => archive(position, true)}
            onRestore={position => archive(position, false)} onReset={resetFilters} />}
        </TabsContent>
      </Tabs>
      {editor && (
        <InvestmentEditor
          key={editor.position?.id || editor.kind}
          position={editor.position}
          initialKind={editor.kind}
          assets={market.assets}
          onSave={save}
          recovery={recovery}
          blocked={!!mutation.pending}
          onClose={() => { if (!mutation.pending) setEditor(null); }}
        />
      )}
    </section>
  );
}
function Stat({
  label,
  value,
  note,
  color,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  color: "orange" | "blue" | "green" | "red";
  icon: React.ReactNode;
}) {
  const colors = {
    orange: "border-orange-400/20 text-orange-300 bg-orange-400/5",
    blue: "border-sky-400/20 text-sky-300 bg-sky-400/5",
    green: "border-[#70ff9b]/20 text-[#70ff9b] bg-[#70ff9b]/5",
    red: "border-[#ff4466]/25 text-[#ff8098] bg-[#ff4466]/5",
  };
  return (
    <article
      className={`min-w-0 rounded-3xl border p-4 sm:p-5 ${colors[color]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted-foreground">{label}</p>
        <span className="hidden sm:block">{icon}</span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums wrap-anywhere sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {note}
      </p>
    </article>
  );
}
function PortfolioWindow({ kind, rows, records, busy, filtered, onAdd, onHistory }: {
  kind: InvestmentKind; rows: ValuedPosition[]; records: ValuedPosition[]; busy: boolean; filtered: boolean;
  onAdd: () => void; onHistory: () => void;
}) {
  const { investmentMoney } = useAccountFormat();
  const crypto = kind === "crypto", totals = summarizeInvestments(rows), counts = summarizeInvestmentRecords(records);
  return <section aria-label={crypto ? "Crypto positions" : "Stocks and ETFs positions"}
    className={`overflow-hidden rounded-3xl border ${crypto ? "border-sky-400/20" : "border-orange-400/20"} bg-card/25`}>
    <header className={`p-5 ${crypto ? "bg-sky-400/5" : "bg-orange-400/5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${crypto ? "bg-sky-400/10 text-sky-300" : "bg-orange-400/10 text-orange-300"}`}>{crypto ? <Bitcoin size={23} /> : <TrendingUp size={23} />}</span>
          <div className="min-w-0"><h2 className="text-lg font-semibold">{crypto ? "Crypto" : "Stocks & ETFs"}</h2><p className="mt-1 text-xs text-muted-foreground">{counts.active} active · {counts.operations} saved records</p></div>
        </div>
        <Button variant="outline" disabled={busy} onClick={onAdd} aria-label={crypto ? "Add crypto position" : "Add stock or ETF position"}
          className={`size-11 shrink-0 rounded-xl bg-transparent dark:bg-transparent ${crypto ? "border-sky-400/25 dark:border-sky-400/25 text-sky-300 dark:hover:bg-sky-400/10" : "border-orange-400/25 dark:border-orange-400/25 text-orange-300 dark:hover:bg-orange-400/10"}`}><Plus size={20} /></Button>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-b border-border pb-4 text-xs">
        <div><dt className="text-muted-foreground">Operations</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{counts.operations}</dd></div>
        <div><dt className="text-muted-foreground">Assets</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{counts.assets}</dd><dd className="mt-1 text-[10px] text-muted-foreground">{counts.activeAssets} active</dd></div>
        <div><dt className="text-muted-foreground">Currencies</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{counts.currencies.length}</dd><dd className="mt-1 text-[10px] text-muted-foreground wrap-anywhere">{counts.currencies.join(" · ") || "—"}</dd></div>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><p className="text-[11px] text-muted-foreground">Current value</p><p className={`mt-1 text-xl font-semibold tabular-nums ${crypto ? "text-sky-300" : "text-orange-300"}`}>{investmentMoney(totals.value)}</p></div>
        <div className="text-right"><p className="text-[11px] text-muted-foreground">Unrealized profit / loss</p><p className={`mt-1 text-lg font-semibold tabular-nums ${profitColor(totals.profit)}`}>{totals.profit !== null && totals.profit >= 0 ? "+" : ""}{investmentMoney(totals.profit)}</p><p className={`mt-1 text-xs tabular-nums ${profitColor(totals.profit)}`}>{percent(totals.percent)}</p></div>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">{totals.priced} of {totals.count} active USD positions priced. Archived records are excluded from value and profit.</p>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">{counts.operations ? "View saved positions and their details." : filtered ? "No matching positions." : "Add your first position to start."}</p>
      <Button variant="outline" disabled={busy} onClick={onHistory} aria-label={crypto ? "Show crypto history" : "Show stocks and ETFs history"} className="h-11 shrink-0 rounded-xl"><History size={16} />Show history</Button>
    </div>
  </section>;
}
