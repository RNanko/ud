"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  YAxis,
  XAxis,
  LabelList,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/app/components/ui/chart";
import { Button } from "@/app/components/ui/button";
import Link from "next/link";
import { ArrowBigLeft } from "lucide-react";
import { useAccountFormat } from "@/hooks/use-account-format";

type chartDataType = {
  month: string;
  income: number;
  outcome: number;
};

export default function ChartBarNegative({
  chartData,
  currency,
  small = false,
}: {
  chartData: chartDataType[];
  currency: string;
  small?: boolean;
}) {
  const { formatAmount } = useAccountFormat();
  const chartConfig = {
    income: { label: "Revenue" },
    outcome: { label: "Spending" },
  } satisfies ChartConfig;

  const chartHeight = small ? "h-[260px]" : "h-[650px]";
  const contentHeight = small ? "h-[200px]" : "h-[500px]";
  const fontSize = small ? 12 : 20;
  const labelFont = small ? 10 : 12;
  const labelOffset = small ? 6 : 12;

  return (
    <Card
      className={`${chartHeight} overflow-hidden flex flex-col items-center relative`}
    >
      <CardTitle className="text-2xl px-5">Revenue & Spending{currency === "NONE" ? "" : ` · ${currency}`}</CardTitle>
      {!small && (
        <CardHeader className="flex-center w-full">
          <Button variant={"ghost"} asChild className="absolute left-5">
            <Link href="/account/finance">
              <ArrowBigLeft /> Back
            </Link>
          </Button>
        </CardHeader>
      )}

      <CardContent className={contentHeight}>
        {!chartData.length && (
          <div className="text-center text-muted-foreground">No data yet</div>
        )}

        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-full">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />

              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize, fill: "var(--foreground)" }}
              />

              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize, fill: "var(--foreground)" }}
              />

              <ReferenceLine y={0} stroke="var(--border)" />

              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />

              <Bar dataKey="income" fill="var(--chart-in)" radius={10}>
                {!small && (
                  <LabelList
                    position="top"
                    offset={labelOffset}
                    fontSize={labelFont}
                  />
                )}
              </Bar>

              <Bar
                dataKey="outcome"
                fill="var(--chart-out)"
                radius={[0, 0, 4, 4]}
              >
                {!small && (
                  <LabelList
                    position="top"
                    offset={labelOffset}
                    fontSize={labelFont}
                  />
                )}
              </Bar>

              {!small && (
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="rect"
                  wrapperStyle={{
                    paddingTop: 20,
                    fontSize: "16px",
                    fontWeight: 500,
                  }}
                />
              )}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <table className="sr-only">
        <caption>Monthly revenue and spending{currency === "NONE" ? "" : ` in ${currency}`}. Spending is shown as a positive amount in this table.</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Spending</th></tr></thead>
        <tbody>{chartData.map(row => <tr key={row.month}><th scope="row">{row.month}</th><td>{formatAmount(row.income)}</td><td>{formatAmount(Math.abs(row.outcome))}</td></tr>)}</tbody>
      </table>
    </Card>
  );
}
