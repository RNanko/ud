"use client";

import type { LucideIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/lib/utils";

type FinanceSelectOption = {
  value: string;
  label: string;
  color?: string;
};

export default function FinanceSelect({
  label,
  title,
  icon: Icon,
  value,
  onValueChange,
  options,
  disabled,
  className,
}: {
  label: string;
  title: string;
  icon: LucideIcon;
  value: string;
  onValueChange: (value: string) => void;
  options: FinanceSelectOption[];
  disabled?: boolean;
  className?: string;
}) {
  // Encode all values so an empty "All categories" value remains valid for Radix.
  const encode = (value: string) => `option:${value}`;

  return (
    <Select value={encode(value)} onValueChange={(next) => {
      // Radix's native form control can emit an empty reset during mounting.
      // Only forward an actual option, including the encoded empty "All" option.
      const option = options.find(option => encode(option.value) === next);
      if (option) onValueChange(option.value);
    }} disabled={disabled}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "min-h-12 w-full min-w-0 rounded-2xl border-border bg-background px-3.5 text-sm text-foreground shadow-none hover:border-primary/40 hover:bg-muted/30 focus-visible:border-primary focus-visible:ring-primary/20 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/10 dark:border-border dark:bg-background dark:hover:bg-muted/30 [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180",
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-primary/80" />
          <span className="min-w-0 truncate"><SelectValue /></span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] rounded-2xl border-border bg-popover p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)]"
      >
        <SelectGroup>
          <SelectLabel className="px-3 pb-2 pt-1.5 text-[10px] font-medium uppercase tracking-[0.14em]">{title}</SelectLabel>
          <SelectSeparator className="mx-1 mb-1.5" />
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={encode(option.value)}
              className="min-h-11 cursor-pointer rounded-xl py-2.5 pl-3 pr-9 text-sm transition-colors focus:bg-muted focus:text-foreground data-[state=checked]:bg-primary/10 data-[state=checked]:font-medium data-[state=checked]:text-primary data-[state=checked]:focus:bg-primary/15 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
            >
              {option.color && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${option.color}`} />}
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
