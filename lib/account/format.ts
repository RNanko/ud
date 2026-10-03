import type { AccountPreferences } from "./preferences";

export function formatAccountDate(date: string, preferences: Pick<AccountPreferences, "dateFormat">) {
  if (preferences.dateFormat === "iso") return date;
  const year = date.slice(0, 4), month = date.slice(5, 7), day = date.slice(8, 10);
  return preferences.dateFormat === "month-first" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

export function formatAccountTimestamp(value: string, preferences: AccountPreferences, includeTime = true) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "Date unavailable";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  const date = formatAccountDate(`${part("year")}-${part("month")}-${part("day")}`, preferences);
  if (!includeTime) return date;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: preferences.timezone, hour: "2-digit", minute: "2-digit", hour12: preferences.timeFormat === "12",
  }).format(instant);
  return `${date} · ${time}`;
}
