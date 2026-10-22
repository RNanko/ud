"use client";

import { useState } from "react";
import { useBackgroundSave } from "./use-background-save";
import { BackgroundSaveError } from "@/lib/background-save-queue";
import { moveGymPlan } from "@/lib/actions/gym.actions";
import { notifyGymChange } from "./use-gym-sync";
import type { GymData } from "@/lib/gym/types";

type Move = { id: string; date: string; timezone: string };
type Command = { base: GymData; payload: Move & { revision: number; mutationId: string; from: string } };

export function useWorkoutMoves(initial: GymData, apply: (snapshot: GymData) => void, owner: string) {
  const [expectedOwner] = useState(owner);
  return useBackgroundSave<GymData, Move, Command>(initial, {
    owner: expectedOwner,
    reduce: (snapshot, input) => ({ ...snapshot, plans: snapshot.plans.map(plan => plan.id === input.id ? { ...plan, date: input.date, timezone: input.timezone } : plan) }),
    apply,
    prepare: (base, input) => {
      const plan = base.plans.find(plan => plan.id === input.id);
      if (!plan) throw new BackgroundSaveError("This workout changed elsewhere. Reload before moving it.", "conflict", base);
      return { base, payload: { ...input, revision: plan.revision, mutationId: crypto.randomUUID(), from: plan.date } };
    },
    save: async ({ base, payload }) => {
      const result = await moveGymPlan(payload, expectedOwner);
      if (!result.success) throw new BackgroundSaveError(result.message, /^(Newer|Workout|Choose)/.test(result.message ?? "") ? "conflict" : "unknown");
      notifyGymChange();
      return { ...base, plans: base.plans.map(plan => plan.id === result.plan.id ? result.plan : plan) };
    },
  });
}
