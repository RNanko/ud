"use client";

import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowDown, ArrowUp, FilterIcon } from "lucide-react";
import { financeTable } from "@/lib/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { DateRange } from "react-day-picker";

type FinanceRow = InferSelectModel<typeof financeTable>;

function SortArrow({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc" | undefined;
}) {
  if (!active) return null;
  return order === "asc" ? (
    <ArrowUp className="w-4 h-4" />
  ) : (
    <ArrowDown className="w-4 h-4" />
  );
}

export function ListHeaders({
  onSort,
  onClearSort,
  sortField,
  sortOrder,
  selectedDate,
  setSelectedDate,
}: {
  onSort: (field: keyof FinanceRow) => void;
  onClearSort: () => void;
  sortField: keyof FinanceRow | undefined;
  sortOrder: "asc" | "desc" | undefined;
  selectedDate: DateRange | undefined;
  setSelectedDate: (d: DateRange | undefined) => void;
}) {
  return (
    <Card className="h-full grid grid-cols-7 gap-2 cursor-pointer p-5 font-bold items-center">
      {/* TYPE */}
      <div className="flex items-center gap-1" onClick={() => onSort("type")}>
        Type
        <SortArrow active={sortField === "type"} order={sortOrder} />
      </div>

      {/* DATE */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="flex items-center gap-2">
              Date
            </button>
          </PopoverTrigger>

          <PopoverContent className="p-2">
            <Calendar
              mode="range"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md"
              timeZone="Europe/Warsaw"
            />

            <div className="mt-2 flex gap-2">
              <button
                className="px-2 py-1 rounded bg-muted text-sm"
                onClick={() => setSelectedDate(undefined)}
                type="button"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => onSort("date")}
          aria-label="Sort by date"
          className="ml-1 flex items-center gap-1"
        >
          {" "}
          .
          <SortArrow active={sortField === "date"} order={sortOrder} />
        </button>
      </div>

      {/* CATEGORY */}
      <div
        className="flex items-center gap-1"
        onClick={() => onSort("category")}
      >
        Category
        <SortArrow active={sortField === "category"} order={sortOrder} />
      </div>

      {/* SUBCATEGORY */}
      <div
        className="flex items-center gap-1"
        onClick={() => onSort("subcategory")}
      >
        Sub
        <SortArrow active={sortField === "subcategory"} order={sortOrder} />
      </div>

      {/* AMOUNT */}
      <div className="flex items-center gap-1" onClick={() => onSort("amount")}>
        Amount
        <SortArrow active={sortField === "amount"} order={sortOrder} />
      </div>

      {/* COMMENT */}
      <div
        className="flex items-center gap-1"
        onClick={() => onSort("comment")}
      >
        Comment
        <SortArrow active={sortField === "comment"} order={sortOrder} />
      </div>

      <button
        type="button"
        onClick={() => {
          onClearSort();
        }}
        className="flex items-center gap-1 text-red-400 hover:text-red-600"
      >
        <FilterIcon className="w-4 h-4" />
        Clear Sort
      </button>
    </Card>
  );
}
