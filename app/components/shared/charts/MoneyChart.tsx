"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MoneyChartPoint, MoneyChartType } from "@/lib/money/charts";

const colors = ["#4db9ed", "#ffab59", "#7bd99c", "#bf9af5", "#f17ca6", "#60c9c1"];
export default function MoneyChart({ type, points, series, formatAmount }: {
  type: MoneyChartType; points: MoneyChartPoint[]; series: { key: string; label: string }[]; formatAmount: (value: number) => string;
}) {
  const horizontal = type === "horizontal";
  const tooltip = <Tooltip formatter={value => formatAmount(Number(value))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 16, color: "var(--foreground)" }} itemStyle={{ color: "var(--foreground)" }} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />;
  // Recharts 2 discovers axes among direct children; a Fragment hides them.
  const axes = [<CartesianGrid key="grid" stroke="var(--border)" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />,
    <XAxis key="x" type={horizontal ? "number" : "category"} dataKey={horizontal ? undefined : "label"} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={horizontal ? value => formatAmount(Number(value)) : value => String(value).length > 18 ? `${String(value).slice(0, 16)}…` : String(value)} tickLine={false} axisLine={false} />,
    <YAxis key="y" type={horizontal ? "category" : "number"} dataKey={horizontal ? "label" : undefined} width={horizontal ? 110 : 70} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={horizontal ? value => String(value).length > 17 ? `${String(value).slice(0, 15)}…` : String(value) : value => formatAmount(Number(value))} tickLine={false} axisLine={false} />,
  ];
  return <div className="max-h-[560px] min-w-0 overflow-auto rounded-2xl bg-background/30 p-2">
    <div style={{ height: horizontal ? Math.max(320, points.length * 48 + 40) : 360, minWidth: horizontal || type === "pie" ? undefined : Math.max(280, points.length * 55) }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {type === "pie" ? <PieChart>{tooltip}<Pie data={points.filter(point => point.total > 0)} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius="80%" isAnimationActive={false}>{points.filter(point => point.total > 0).map((point, index) => <Cell key={point.key} fill={colors[index % colors.length]} stroke="var(--background)" />)}</Pie></PieChart>
          : type === "line" ? <LineChart data={points} accessibilityLayer margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>{axes}{tooltip}{series.map((item, index) => <Line key={item.key} type="linear" dataKey={item.key} name={item.label} stroke={colors[index % colors.length]} strokeWidth={2} dot={points.length < 30} isAnimationActive={false} />)}</LineChart>
            : <BarChart data={points} layout={horizontal ? "vertical" : "horizontal"} accessibilityLayer margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>{axes}{tooltip}{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} fill={colors[index % colors.length]} stackId={type === "stacked" ? "amount" : undefined} maxBarSize={40} isAnimationActive={false} />)}</BarChart>}
      </ResponsiveContainer>
    </div>
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-2 py-3 text-xs text-muted-foreground">{(type === "pie" ? points.map((point, index) => ({ key: point.key, label: point.label, color: colors[index % colors.length] })) : series.map((item, index) => ({ ...item, color: colors[index % colors.length] }))).map(item => <span key={item.key} className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: item.color }} /><span className="wrap-anywhere">{item.label}</span></span>)}</div>
  </div>;
}
