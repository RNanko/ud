"use client";

import { GymButton } from "./GymUI";
export default function ErrorPage({
  reset
}: {
  reset: () => void;
}) {
  return <section className="gym-scope rounded-3xl border border-border p-6">
    <h1 className="text-2xl font-semibold">Workout records could not load</h1>
    <p className="my-3 text-muted-foreground">Check your connection and try again. No demo results have been substituted.</p>
    <GymButton tone="blue" onClick={reset}>Retry loading</GymButton>
  </section>;
}
