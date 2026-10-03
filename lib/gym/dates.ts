import { localDate } from "../finance";
export { localDate };
export function dateInZone(date = new Date(), timezone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return ["year", "month", "day"].map(name => parts.find(part => part.type === name)!.value).join("-");
}
function calendarDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}
// Calendar arithmetic uses a date-only anchor, not elapsed hours across local DST.
export function addCalendarDays(date: string, days: number) {
  const anchor = calendarDate(date);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(anchor.getUTCDate()).padStart(2, "0")}`;
}
export function weekStart(date: string, startsOn: "monday"|"sunday"="monday") {
  return addCalendarDays(date, -((calendarDate(date).getUTCDay() + (startsOn==="monday"?6:0)) % 7));
}
export function weekDates(date: string, startsOn: "monday"|"sunday"="monday") {
  return Array.from({
    length: 7
  }, (_, index) => addCalendarDays(weekStart(date,startsOn), index));
}
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric"
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(calendarDate(date).getTime())) return "Choose a date";
  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC"
  }).format(calendarDate(date));
}
export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
