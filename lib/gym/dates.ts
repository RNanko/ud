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
export { addCalendarDays, weekStart, weekDates, dateLabel } from "../calendar";
export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
