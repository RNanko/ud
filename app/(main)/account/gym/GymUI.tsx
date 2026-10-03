"use client";

import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import { X, SlidersHorizontal, Plus, Minus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import FinanceSelect from "../finance/FinanceSelect";
import { cn } from "@/lib/utils";
const MotionButton = motion.create(Button);
export function GymButton({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<typeof MotionButton> & {
  tone?: "blue" | "orange" | "neutral" | "completed" | "in-progress" | "unconfirmed";
}) {
  const reduced = useReducedMotion();
  const status = ["completed", "in-progress", "unconfirmed"].includes(tone) ? tone : undefined;
  return <MotionButton type="button" variant="outline" {...props} data-workout-status={status} whileTap={reduced || props.disabled ? undefined : { scale: 0.97 }} transition={{ duration: 0.12 }} className={cn("gym-button min-h-11 h-auto rounded-2xl px-3 py-2 whitespace-normal", tone === "blue" && "gym-blue", tone === "orange" && "gym-orange", status && "gym-workout-state", className)} />;
}
export function Field({
  label,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
}) {
  const id = useId();
  return <label htmlFor={id} className="grid min-w-0 gap-2 text-sm font-medium">{label}<Input id={id} {...props} className={cn("gym-input min-h-12 rounded-2xl", props.className)} />
  </label>;
}
export function Notes({
  label,
  ...props
}: ComponentProps<typeof Textarea> & {
  label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const hasNotes = String(props.value ?? props.defaultValue ?? "").trim().length > 0;
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? hasNotes;
  const action = open ? "Hide" : hasNotes ? "Show" : "Add";
  if (props.disabled && !hasNotes) return null;
  return <div className="gym-notes space-y-2">
    <GymButton aria-label={`${action} ${label}`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setExpanded(!open)} className="text-sm text-muted-foreground">
      {open ? <Minus size={15} /> : <Plus size={15} />}{action} notes
    </GymButton>
    <div id={`${id}-panel`} hidden={!open}>
      {open && <motion.div initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.16 }}><label htmlFor={id} className="grid gap-2 text-sm font-medium">{label}<Textarea id={id} {...props} onChange={event => { setExpanded(true); props.onChange?.(event); }} className={cn("gym-input min-h-20 rounded-2xl", props.className)} /></label></motion.div>}
    </div>
  </div>;
}
export function NumberField({
  label,
  value,
  onChange,
  step = "any",
  min = 0,
  max,
  disabled
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number | string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return <Field label={label} type="number" inputMode={step === 1 ? "numeric" : "decimal"} min={min} max={max} step={step} value={value ?? ""} disabled={disabled} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} />;
}
export function GymSelect({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><span>{label}</span><FinanceSelect disabled={disabled} label={label} title={label} icon={SlidersHorizontal} value={value} onValueChange={onChange} options={options.map(option => ({
    value: option,
    label: option || "All"
  }))} className="gym-input" /></div>;
}
export function GymDialog({
  title,
  description,
  open,
  onClose,
  children,
  full = false
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
}) {
  const reduced = useReducedMotion();
  const present = useIsPresent(), opener = useRef<HTMLElement | null>(null);
  if (!open && present) return null;
  return <Dialog.Root open={open && present} onOpenChange={value => {
    if (!value) onClose();
  }}>
    <Dialog.Portal forceMount>
      <Dialog.Overlay forceMount asChild><motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" /></Dialog.Overlay>
      <Dialog.Content forceMount asChild onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }} onInteractOutside={event => event.preventDefault()}><motion.div inert={!present} aria-hidden={!present || undefined} initial={reduced ? false : { opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : 6, scale: reduced ? 1 : 0.99 }} transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }} className={cn("gym-dialog fixed z-50 flex flex-col gap-5 border border-border bg-background p-5 shadow-2xl outline-none", full ? "inset-0 overflow-y-auto sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-[min(960px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl" : "bottom-0 left-0 max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(540px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl")}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
            <Dialog.Description className={description ? "mt-1 text-sm text-muted-foreground" : "sr-only"}>{description || title}</Dialog.Description>
          </div>
          <GymButton aria-label="Close dialog" onClick={onClose}>
            <X />
          </GymButton>
        </header>{children}</motion.div></Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return <GymDialog open title={title} description={description} onClose={() => {
    if (!busy) onClose();
  }}>
    <div className="flex flex-wrap gap-3">
      <GymButton disabled={busy} onClick={onClose}>Cancel</GymButton>
      <GymButton tone="orange" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          await onConfirm();
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Save failed — retry");
        } finally {
          setBusy(false);
        }
      }}>{busy ? "Saving…" : "Confirm"}</GymButton>
    </div>{error && <p role="alert" className="gym-error">{error}</p>}</GymDialog>;
}
