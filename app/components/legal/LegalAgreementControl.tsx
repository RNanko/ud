"use client";
import { useId } from "react";
import type { LegalBundle } from "@/lib/legal/types";
export default function LegalAgreementControl({ bundle, accepted, onChange, disabled }: { bundle: LegalBundle | null; accepted: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="flex items-start gap-3">
    <label className="flex min-h-11 shrink-0 items-start pt-1"><input type="checkbox" className="size-5 accent-primary-plus" checked={accepted} disabled={disabled} onChange={event => onChange(event.target.checked)} aria-labelledby={`${id}-label`} /></label><p id={`${id}-label`} className="text-sm leading-relaxed">I agree to the <a href={bundle?.terms.href || "/terms"} target="_blank" rel="noopener noreferrer" className="text-primary-plus underline" aria-label="Terms & Conditions (opens in a new tab)">Terms & Conditions</a> and acknowledge the <a href={bundle?.privacy.href || "/privacy"} target="_blank" rel="noopener noreferrer" className="text-primary-plus underline" aria-label="Privacy Policy (opens in a new tab)">Privacy Policy</a>.</p>
  </div>;
}
