"use client";

import { useId } from "react";
import { LoaderCircle } from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type EventCompletionPending = { id: string; completed: boolean };

export function EventLoadingSpinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn("pointer-events-none size-4 animate-spin text-[var(--event-accent)] motion-reduce:animate-none", className)} />;
}

export default function EventCompletionCheckbox({
  title,
  checked,
  pending,
  onChange,
}: {
  title: string;
  checked: boolean;
  pending?: EventCompletionPending;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--event-accent)] transition-colors motion-reduce:transition-none",
        pending
          ? "cursor-wait"
          : "cursor-pointer hover:bg-[color-mix(in_srgb,var(--event-accent)_8%,transparent)]",
      )}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <Checkbox
          id={id}
          checked={checked}
          disabled={!!pending}
          aria-label={`Completed: ${title}`}
          aria-busy={!!pending}
          onCheckedChange={onChange}
          className={cn(
            "size-6 cursor-inherit rounded-lg border-[var(--event-accent)] bg-background text-background transition-[background-color,border-color,box-shadow] duration-200 dark:bg-background data-[state=checked]:border-[var(--event-accent)] data-[state=checked]:bg-[var(--event-accent)] data-[state=checked]:text-background dark:data-[state=checked]:bg-[var(--event-accent)] focus-visible:ring-[var(--event-accent)] disabled:cursor-wait disabled:opacity-100 [&_svg]:size-4",
            pending && "[&_[data-slot=checkbox-indicator]]:invisible",
          )}
          style={{
            borderRadius: 8,
            boxShadow: checked
              ? "0 0 12px color-mix(in srgb, var(--event-accent) 25%, transparent)"
              : undefined,
          }}
        />
        {pending && (
          <EventLoadingSpinner
            className={cn(
              "absolute",
              checked ? "text-background" : "text-[var(--event-accent)]",
            )}
          />
        )}
      </span>
      <span className="sr-only">
        {pending
          ? pending.completed
            ? "Completing…"
            : "Reopening…"
          : checked
            ? "Completed"
            : "Mark complete"}
      </span>
    </label>
  );
}
