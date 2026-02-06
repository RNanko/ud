"use client";

import { useState, useMemo } from "react";
import { financeTable } from "@/lib/db/schema";
import { InferSelectModel } from "drizzle-orm";

import FinanceList from "./finance-list";
import { ListHeaders } from "./list-headers";
import FinanceFilterFunc from "./finance-filter-func";

type FinanceRow = InferSelectModel<typeof financeTable>;
import { DateRange } from "react-day-picker";

export default function FinanceListFilter({ data }: { data: FinanceRow[] }) {
  const [sortField, setSortField] = useState<keyof FinanceRow | undefined>(
    "date",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | undefined>(
    "desc",
  );
  const [listLength, setListLength] = useState<string>("5");

  const dates = data.map((item) => new Date(item.date));

  const dataDateRange =
    dates.length > 0
      ? {
          from: new Date(Math.min(...dates.map((d) => d.getTime()))),
          to: new Date(Math.max(...dates.map((d) => d.getTime()))),
        }
      : undefined;

  // Single date selection (from calendar)
  const [selectedDate, setSelectedDate] = useState<DateRange | undefined>(
    dataDateRange,
  );

  // Derived: Convert selected date → YYYY-MM-DD
  const startDateString =
    selectedDate?.from instanceof Date
      ? selectedDate.from.toISOString().slice(0, 10)
      : undefined;

  const endDateString =
    selectedDate?.to instanceof Date
      ? selectedDate.to.toISOString().slice(0, 10)
      : undefined;

  // Sorting + Filtering
  const filteredData = useMemo(() => {
    return FinanceFilterFunc(data, {
      sortBy: sortField,
      order: sortOrder,
      startDate: startDateString,
      endDate: endDateString, // exact day match
    });
  }, [data, sortField, sortOrder, startDateString, endDateString]);

  // Sorting handler
  function onSort(field: keyof FinanceRow) {
    if (field === sortField) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }
  function onClearSort() {
    setSortField(undefined);
    setSortOrder(undefined);
    setSelectedDate(undefined);
  }

  return (
    <div className="space-y-6">
      <ListHeaders
        onSort={onSort}
        onClearSort={onClearSort}
        sortField={sortField}
        sortOrder={sortOrder}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        setListLength={setListLength}
        listLength={listLength}
      />

      <FinanceList data={filteredData} listLenth={listLength} />
    </div>
  );
}
