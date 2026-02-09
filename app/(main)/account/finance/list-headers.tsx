import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowDown, ArrowUp, Calendar1, FilterIcon } from "lucide-react";
import { financeTable } from "@/lib/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  setListLength,
  listLength,
}: {
  onSort: (field: keyof FinanceRow) => void;
  onClearSort: () => void;
  sortField: keyof FinanceRow | undefined;
  sortOrder: "asc" | "desc" | undefined;
  selectedDate: DateRange | undefined;
  setSelectedDate: (d: DateRange | undefined) => void;
  setListLength: (lenth: string) => void;
  listLength: string;
}) {
  return (
    <Card className="text-res h-full grid grid-cols-7 gap-2 cursor-pointer p-5 font-bold items-center min-w-xl">
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
              <Calendar1 />
            </button>
          </PopoverTrigger>

          <PopoverContent className="p-2">
            <Calendar
              mode="range"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md"
              timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
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
          Date
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
      
      {/* SETTINGS Btn */}
      <div className="flex flex-col items-center gap-2">
        <Button
        variant={"outline"}
          onClick={() => {
            onClearSort();
          }}
          
        >
          <FilterIcon className="w-4 h-4" />
          Clear
        </Button>
        <Select
          value={listLength}
          onValueChange={(value) => setListLength(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a list size" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup className="text-center">
              <SelectLabel>List Size</SelectLabel>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
