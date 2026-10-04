"use client";

import { useId, useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enGB } from "react-day-picker/locale";
import { Input } from "@/app/components/ui/input";
import { Calendar } from "@/app/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { birthDateFromInput, birthDateInputValue, registrationToday } from "@/lib/account/birth-date";

export default function BirthDateField({ value, onChange, disabled = false, required = true, label = "Date of birth" }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const today = parseISO(registrationToday());
  const selected = value && birthDateFromInput(value) ? parseISO(value) : undefined;
  const invalid = touched && !!draft && !birthDateFromInput(draft);
  return <div className="auth-birth-date">
    <label htmlFor={id}>{label}</label>
    <Popover open={open} onOpenChange={setOpen}>
      <div className="auth-date-input">
        <Input id={id} type="text" className="gym-input" placeholder="DD/MM/YYYY" autoComplete="bday" required={required} disabled={disabled}
          maxLength={10} value={draft ?? birthDateInputValue(value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={event => {
            const next = event.target.value;
            setDraft(next); setTouched(false); onChange(birthDateFromInput(next));
          }} onBlur={() => setTouched(true)} />
        <PopoverTrigger asChild><button type="button" disabled={disabled} className="auth-date-trigger" aria-label="Choose date of birth" title="Choose date of birth">
          <CalendarDays size={20} aria-hidden="true" />
        </button></PopoverTrigger>
      </div>
      <PopoverContent className="auth-calendar-popover" align="end" sideOffset={10} collisionPadding={16} aria-label="Choose date of birth">
        <p>Choose your birth date</p>
        <Calendar mode="single" selected={selected} defaultMonth={selected ?? today} today={today} onSelect={date => {
          if (!date) return;
          const next = birthDateFromInput(format(date, "yyyy-MM-dd"));
          if (!next) return;
          onChange(next); setDraft(null); setTouched(false); setOpen(false);
        }} captionLayout="dropdown" reverseYears startMonth={new Date(1900, 0)} endMonth={today}
          disabled={{ after: today }} locale={enGB} formatters={{ formatMonthDropdown: date => format(date, "MMM") }} autoFocus className="auth-calendar" />
      </PopoverContent>
    </Popover>
    {invalid && <p id={`${id}-error`} role="alert" className="font-normal text-sm text-destructive">Enter a valid birth date as DD/MM/YYYY.</p>}
  </div>;
}
