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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowBigLeft } from "lucide-react";

type chartDataType = {
  month: string;
  income: number;
  outcome: number;
};

export default function ChartBarNegative({
  chartData,
  small = false,
}: {
  chartData: chartDataType[];
  small?: boolean;
}) {
  const chartConfig = {
    visitors: {
      label: "Income&Outcome",
    },
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
      <CardTitle className="text-2xl">Income & Outcome Chart</CardTitle>
      {!small && (
        <CardHeader className="flex-center w-full">
          <Button variant={"ghost"} asChild className="absolute left-5">
            <Link href="./">
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
                tick={{ fontSize, fill: "hsl(var(--foreground))" }}
              />

              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize, fill: "hsl(var(--foreground))" }}
              />

              <ReferenceLine y={0} stroke="hsl(var(--border))" />

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
    </Card>
  );
}
