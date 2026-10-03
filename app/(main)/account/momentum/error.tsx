"use client";
import { GymButton } from "../gym/GymUI";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="gym-scope space-y-4 rounded-3xl border p-6"><h1 className="text-2xl font-semibold">Momentum could not be opened</h1><p>Your saved records have not been replaced with an empty history.</p><GymButton tone="blue" onClick={reset}>Retry loading</GymButton></section>; }
