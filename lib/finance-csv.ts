import type { FinanceEntry } from "./finance";
import { cashMinor, cashString } from "./account/decimal";

function textCell(value: string | null) {
  const text = value || "";
  // Quoting alone does not prevent spreadsheet programs from executing formulas.
  const safe = /^[\t\r\n]/u.test(text) || /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function financeCsv(entries: FinanceEntry[]) {
  const lines = ["Date,Type,Category,Detail,Amount,Currency,Note,ID"];
  for (const entry of entries) {
    lines.push([
      textCell(entry.date), textCell(entry.type === "+" ? "Revenue" : "Spending"),
      textCell(entry.category), textCell(entry.subcategory), cashString(cashMinor(entry.amount)),textCell(entry.currency??"Currency not recorded"),
      textCell(entry.comment), textCell(entry.id),
    ].join(","));
  }
  // UTF-8 BOM preserves accented text in Excel; CRLF and quoting preserve multiline notes.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function financeCsvFilename(entries: FinanceEntry[]) {
  const dates = entries.map(entry => entry.date).sort();
  return dates.length ? `finance-history-${dates[0]}-to-${dates.at(-1)}.csv` : "finance-history.csv";
}
