"use client";
import { useId } from "react";
import { Checkbox } from "@/app/components/ui/checkbox";
import type { LegalBundle } from "@/lib/legal/types";
export default function LegalAgreementControl({
  bundle,
  accepted,
  onChange,
  disabled,
}: {
  bundle: LegalBundle | null;
  accepted: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const labelClass = disabled ? "cursor-not-allowed" : "cursor-pointer";
  const linkClass =
    "text-primary-plus underline decoration-primary-plus/40 underline-offset-4 hover:decoration-primary-plus focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-plus";
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <label
          htmlFor={id}
          className={`flex min-h-11 w-8 shrink-0 items-start justify-center pt-1.5 ${labelClass}`}
        >
          <Checkbox
            id={id}
            className="size-5 cursor-pointer rounded-[6px] border-primary-plus/45 bg-primary-plus/5 focus-visible:ring-primary-plus/35 disabled:cursor-not-allowed"
            checked={accepted}
            disabled={disabled}
            onCheckedChange={(value) => onChange(value === true)}
            aria-labelledby={`${id}-label`}
          />
        </label>
        <p
          id={`${id}-label`}
          className="min-w-0 pt-1 text-sm leading-6 text-foreground/90"
        >
          <label htmlFor={id} className={labelClass}>
            I agree to the{" "}
          </label>
          <a
            href={bundle?.terms.href || "/terms"}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label="Terms & Conditions (opens in a new tab)"
          >
            Terms & Conditions
          </a>
          <label htmlFor={id} className={labelClass}>
            {" "}
            and acknowledge the{" "}
          </label>
          <a
            href={bundle?.privacy.href || "/privacy"}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label="Privacy Policy (opens in a new tab)"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>

    </div>
  );
}
