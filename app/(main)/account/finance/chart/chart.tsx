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
}: {
  chartData: chartDataType[];
}) {
  const chartConfig = {
    visitors: {
      label: "Income&Outcome",
    },
  } satisfies ChartConfig;
  return (
    <Card className="h-[650px] overflow-auto flex flex-col justify-between items-center relative">
      <CardHeader className="flex-center w-full">
        <Button variant={"ghost"} asChild className="absolute left-5">
          <Link href="./">
            <ArrowBigLeft /> Back
          </Link>
        </Button>
        <CardTitle className="text-2xl">Income & Outcome Chart</CardTitle>
      </CardHeader>

      <CardContent className="h-[500px]">
        {!chartData.length && (
          <div className="text-center text-white text-2xl">No data yet</div>
        )}
        {chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-full ">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />

              {/* X axis */}
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{
                  fontSize: 16,
                  fill: "hsl(var(--foreground))",
                  fontWeight: 500,
                }}
              />

              {/* Y axis WITH zero */}
              <YAxis
                domain={["auto", "auto"]}
                tick={{
                  fontSize: 16,
                  fill: "hsl(var(--foreground))",
                  fontWeight: 500,
                }}
              />

              {/* Zero baseline */}
              <ReferenceLine y={0} stroke="hsl(var(--border))" />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="text-md px-4 py-3"
                  />
                }
              />

              <Bar dataKey="income" fill="var(--chart-in)" radius={10}>
                <LabelList
                  position="top"
                  offset={12}
                  className="text-md text-white "
                  fontSize={12}
                />
              </Bar>

              <Bar
                dataKey="outcome"
                fill="var(--chart-out)"
                radius={[0, 0, 4, 4]}
              >
                <LabelList
                  position="top"
                  offset={12}
                  className="text-md text-white "
                  fontSize={12}
                />
              </Bar>

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
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
