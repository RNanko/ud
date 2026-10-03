"use client";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Check, Circle, Dumbbell, CalendarDays, ListTodo } from "lucide-react";
import type { Activity } from "@/lib/momentum/types";
export { GymButton as Action, GymDialog as Sheet, Field, Notes, GymSelect as Picker, Confirm } from "../gym/GymUI";
export function Panel({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) { return <section aria-label={label} className={`momentum-panel rounded-3xl border border-border bg-card/40 p-5 sm:p-6 ${className}`}>{children}</section>; }
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) { const reduced = useReducedMotion(); return <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className={className}>{children}</motion.div>; }
export function Expand({ children, open, id }: { children: ReactNode; open: boolean; id: string }) { const reduced = useReducedMotion(); return <motion.div id={id} inert={!open} aria-hidden={!open} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="overflow-hidden">{children}</motion.div>; }
export function SourceLabel({ activity }: { activity: Activity }) { const Icon = activity.ref.kind === "task" ? ListTodo : activity.ref.kind === "workout" ? Dumbbell : CalendarDays; return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={14} />{activity.detail}{activity.time ? ` · ${activity.time}` : ""}</p>; }
export function SourceLink({ activity, children }: { activity: Activity; children?: ReactNode }) { return <Link href={activity.href} className="gym-button inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-plus">{children ?? "Open source"}<ArrowUpRight size={15} /></Link>; }
export function StepMark({ done }: { done: boolean }) { return done ? <Check size={18} className="shrink-0 text-primary-minus" aria-label="Completed" /> : <Circle size={18} className="shrink-0 text-primary-plus" aria-label="Not completed" />; }
export function Empty({ children }: { children: ReactNode }) { return <p className="rounded-2xl border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">{children}</p>; }
