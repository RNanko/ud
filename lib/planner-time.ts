import z from "zod";
export const timingSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  duration: z.number().int().min(1).max(1440).nullable(),
  overnight: z.boolean(),
  order: z.number().finite().optional()
}).strict().superRefine((value, ctx) => {
  if (value.start && value.duration && timeMinutes(value.start) + value.duration >= 1440 && !value.overnight) ctx.addIssue({
    code: "custom",
    message: "Select an end date on the following day for an overnight event."
  });
  if (value.overnight && (!value.start || !value.duration || timeMinutes(value.start) + value.duration < 1440)) ctx.addIssue({
    code: "custom",
    message: "An overnight end must be on the following day."
  });
});
export type EventTiming = z.infer<typeof timingSchema>;
export const untimed = (): EventTiming => ({
  start: null,
  duration: null,
  overnight: false
});
export function timeMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function clockTime(minutes: number) {
  return Number.isFinite(minutes) ? `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` : "";
}
export function timeLabel(value?: EventTiming, hour12 = false) {
  if (!value?.start) return "Any time";
  const format = (time: string) => hour12 ? new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  }).format(new Date(`2000-01-01T${time}:00Z`)) : time;
  return `${format(value.start)}${value.duration ? `–${format(clockTime(timeMinutes(value.start) + value.duration))}${value.overnight ? " (+1 day)" : ""}` : ""}`;
}
