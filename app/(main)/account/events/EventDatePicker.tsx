"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enGB } from "react-day-picker/locale";
import { Calendar } from "@/app/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { dateLabel } from "@/lib/gym/dates";
import { GymButton } from "../gym/GymUI";

export default function EventDatePicker({ value, onChange, disabled }: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  return <div className="grid gap-2 text-sm font-medium">
    <span>Scheduled date</span>
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <GymButton disabled={disabled} aria-label="Scheduled date" className="gym-input w-full justify-between text-left">
          {dateLabel(value, { day: "numeric", month: "long", year: "numeric" })}
          <CalendarDays size={18} aria-hidden="true" />
        </GymButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-1" collisionPadding={16}>
        <Calendar mode="single" selected={selected} defaultMonth={selected} captionLayout="dropdown"
          startMonth={new Date(1900, 0)} endMonth={new Date(2200, 11)} locale={enGB} autoFocus
          onSelect={date => { if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); } }} />
      </PopoverContent>
    </Popover>
    <p className="text-xs font-normal text-muted-foreground">Choose any date, including a different week or year.</p>
  </div>;
}
