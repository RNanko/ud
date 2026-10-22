"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { enGB } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/app/components/ui/calendar";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

export default function ChartDatePicker({ label, value, onChange, disabled, minimum, maximum, required = false, modal = false, compact = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; minimum?: string; maximum?: string; required?: boolean; modal?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const calendar = useAccountCalendar();
  const selected = value ? parseISO(value) : undefined;
  return <div className={compact ? "min-w-0" : "min-w-0 space-y-1.5"}>
    {!compact && <span className="block text-xs text-muted-foreground">{label}</span>}
    <Popover modal={modal} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-label={label} className={`${compact ? "h-11 rounded-xl px-3 text-xs" : "h-12 rounded-2xl px-3.5 text-sm"} w-full min-w-0 justify-between bg-background dark:bg-background`}><span className="truncate">{value ? calendar.dateLabel(value) : compact ? label : required ? "Choose date" : "Any date"}</span><CalendarDays size={17} className="shrink-0 text-primary" /></Button></PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-24px)] rounded-2xl p-1" collisionPadding={12}>
        <Calendar mode="single" selected={selected} defaultMonth={selected} captionLayout="dropdown" weekStartsOn={calendar.startsOn === "monday" ? 1 : 0}
          startMonth={new Date(1900, 0)} endMonth={new Date(2200, 11)} locale={enGB} autoFocus
          disabled={[...(minimum ? [{ before: parseISO(minimum) }] : []), ...(maximum ? [{ after: parseISO(maximum) }] : [])]}
          onSelect={date => { if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); } }} />
        {!required && <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => { onChange(""); setOpen(false); }}>Clear date</Button>}
      </PopoverContent>
    </Popover>
  </div>;
}
