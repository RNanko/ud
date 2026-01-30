import { financeTable } from "@/lib/db/schema";
import { InferSelectModel } from "drizzle-orm";

type SortOrder = "asc" | "desc";
type FinanceRow = InferSelectModel<typeof financeTable>;
interface FilterOptions {
  order?: SortOrder;
  sortBy?: keyof FinanceRow;
  startDate?: string;
  endDate?: string;
}

export default function FinanceFilterFunc(
  data: FinanceRow[],
  { order = "asc", startDate, endDate, sortBy = "id" }: FilterOptions = {}
): FinanceRow[] {
  const hasStart = Boolean(startDate && startDate.trim());
  const hasEnd = Boolean(endDate && endDate.trim());

  let result: FinanceRow[] = Array.isArray(data) ? [...data] : [];

  // Convert financeRow.date into "YYYY-MM-DD" string for safe lexicographic comparison
  const normalize = (d: string | Date | null | undefined): string | null => {
    if (!d) return null;
    if (typeof d === "string") return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
  };

  // --- Date Range Filtering ---
  if (hasStart || hasEnd) {
    result = result.filter((row) => {
      if (!row.date) return false;

      const d = normalize(row.date);
      if (!d) return false;

      const afterStart = hasStart ? d >= startDate! : true;
      const beforeEnd = hasEnd ? d <= endDate! : true;

      return afterStart && beforeEnd;
    });
  }

  // --- Sorting Logic ---
  const dir = order === "desc" ? -1 : 1;

  const decorated = result.map((item, idx) => ({ item, idx }));

  decorated.sort((a, b) => {
    const av = a.item?.[sortBy];
    const bv = b.item?.[sortBy];

    // Handle undefined/null values
    const aU = av == null;
    const bU = bv == null;
    if (aU && bU) return a.idx - b.idx;
    if (aU) return 1 * dir;
    if (bU) return -1 * dir;

    // Sorting numbers
    if (typeof av === "number" && typeof bv === "number") {
      return av === bv ? a.idx - b.idx : (av < bv ? -1 : 1) * dir;
    }

    // Sorting dates
    if (sortBy === "date") {
      const da = normalize(av as Date | string);
      const db = normalize(bv as Date | string);

      if (da === db) return a.idx - b.idx;
      return da! < db! ? -1 * dir : 1 * dir;
    }

    // Strings (case insensitive)
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as === bs) return a.idx - b.idx;

    return as < bs ? -1 * dir : 1 * dir;
  });

  return decorated.map((x) => x.item);
}
