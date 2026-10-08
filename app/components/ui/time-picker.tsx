"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

/** Values always use HH:mm; display can follow either clock format. */
export function TimePicker({ label, value, onChange, hour12 = false, optional = false, disabled = false, defaultValue = "09:00" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hour12?: boolean;
  optional?: boolean;
  disabled?: boolean;
  defaultValue?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"bottom" | "right">("bottom");
  const selectedHour = useRef<HTMLButtonElement>(null);
  const selectedMinute = useRef<HTMLButtonElement>(null);
  const selected = value || defaultValue;
  const [hour, minute] = selected.split(":").map(Number);
  const pad = (number: number) => String(number).padStart(2, "0");
  const display = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return hour12 ? `${pad(h % 12 || 12)}:${pad(m)} ${h < 12 ? "AM" : "PM"}` : time;
  };
  const choose = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`);
  const hours = Array.from({ length: hour12 ? 12 : 24 }, (_, index) => hour12 ? (index + 1) % 12 + (hour >= 12 ? 12 : 0) : index);
  const optionClass = "h-11 w-full cursor-pointer rounded-xl text-base tabular-nums transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";
  const columnStyle = { height: `clamp(132px, calc(var(--radix-popover-content-available-height) - ${hour12 ? 200 : 144}px), 228px)` };
  const columnClass = "relative overflow-y-auto overscroll-contain touch-pan-y rounded-2xl border border-primary/15 bg-background/50 p-1 [scrollbar-width:thin] [scrollbar-color:var(--primary)_transparent]";
  function navigateColumn(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
    centerOption(buttons[next]);
    buttons[next].click();
  }
  function centerOption(button: HTMLButtonElement | null) {
    const column = button?.parentElement;
    if (!button || !column) return;
    column.scrollTop = button.offsetTop - (column.clientHeight - button.clientHeight) / 2;
  }

  return <div className="grid min-w-0 gap-2">
    <label id={`${id}-label`} className="text-sm font-medium">{label}</label>
    <Popover modal open={open && !disabled} onOpenChange={next => {
      if (next) setSide(typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches ? "right" : "bottom");
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-labelledby={`${id}-label`} disabled={disabled}
          className="gym-input min-h-14 w-full cursor-pointer justify-between gap-3 rounded-2xl border-primary/25 bg-primary/5 px-4 text-base font-medium shadow-none hover:border-primary/60 hover:bg-primary/10 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/15">
          <span className={cn("tabular-nums", !value && "text-muted-foreground text-sm")}>{value ? display(value) : "Choose time"}</span>
          <Clock3 aria-hidden="true" className="size-5 shrink-0 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" side={side} sideOffset={8} collisionPadding={12} aria-label={`${label} selector`}
        className="max-h-[var(--radix-popover-content-available-height)] w-60 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border-primary/25 bg-popover p-3 shadow-[0_20px_60px_-12px_rgba(0,0,0,.8)]"
        onOpenAutoFocus={event => {
          event.preventDefault();
          // Radix sets the available height after positioning the portal.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            selectedHour.current?.focus({ preventScroll: true });
            centerOption(selectedHour.current);
            centerOption(selectedMinute.current);
          }));
        }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scroll to choose</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{display(selected)}</p>
        </div>
        {hour12 && <div role="group" aria-label={`${label} period`} className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
          {["AM", "PM"].map((period, index) => <button key={period} type="button" disabled={disabled} aria-pressed={Math.floor(hour / 12) === index}
            onClick={() => choose(hour % 12 + index * 12, minute)}
            className={cn("min-h-11 cursor-pointer rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", Math.floor(hour / 12) === index ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{period}</button>)}
        </div>}
        <div className="grid grid-cols-2 gap-3">
          <div><p className="mb-2 text-center text-xs text-muted-foreground">Hour</p>
            <div role="group" aria-label={`${label} hour`} onKeyDown={navigateColumn} style={columnStyle} className={columnClass}>
              {hours.map(h => <button key={h} ref={h === hour ? selectedHour : undefined} type="button" disabled={disabled} tabIndex={h === hour ? 0 : -1} aria-label={`Hour ${hour12 ? h % 12 || 12 : pad(h)}`} aria-pressed={h === hour}
                onClick={() => choose(h, minute)} className={cn(optionClass, h === hour && "bg-primary/15 font-semibold text-primary")}>{hour12 ? pad(h % 12 || 12) : pad(h)}</button>)}
            </div></div>
          <div><p className="mb-2 text-center text-xs text-muted-foreground">Minute</p>
            <div role="group" aria-label={`${label} minute`} onKeyDown={navigateColumn} style={columnStyle} className={columnClass}>
              {Array.from({ length: 60 }, (_, m) => <button key={m} ref={m === minute ? selectedMinute : undefined} type="button" disabled={disabled} tabIndex={m === minute ? 0 : -1} aria-label={`Minute ${pad(m)}`} aria-pressed={m === minute}
                onClick={() => choose(hour, m)} className={cn(optionClass, m === minute && "bg-primary/15 font-semibold text-primary")}>{pad(m)}</button>)}
            </div></div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          {optional ? <Button type="button" variant="ghost" disabled={disabled} className="min-h-11 text-sm text-muted-foreground" onClick={() => { onChange(""); setOpen(false); }}>Clear time</Button>
            : null}
          <Button type="button" disabled={disabled} className="min-h-11 rounded-xl" onClick={() => { if (!value) onChange(selected); setOpen(false); }}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
