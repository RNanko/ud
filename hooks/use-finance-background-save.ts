"use client";

import { useState } from "react";
import { useBackgroundSave } from "./use-background-save";
import { BackgroundSaveError } from "@/lib/background-save-queue";
import { commitFinance } from "@/lib/actions/finance.actions";
import { categoryKey } from "@/lib/finance-playground";
import type { FinanceCommand, FinanceSnapshot } from "@/lib/money/types";

export function useFinanceBackgroundSave(initial: FinanceSnapshot, apply: (snapshot: FinanceSnapshot) => void, owner: string) {
  const [expectedOwner] = useState(owner);
  return useBackgroundSave<FinanceSnapshot, FinanceCommand["data"], FinanceCommand>(initial, {
    owner: expectedOwner,
    apply,
    reduce: (snapshot, data) => {
      if (data.kind === "entry") return { ...snapshot, entries: [
        ...snapshot.entries.filter(entry => entry.id !== data.id),
        { ...data.entry, id: data.id, subcategory: data.entry.subcategory ?? "", comment: data.entry.comment ?? "" },
      ] };
      if (data.kind === "delete") return { ...snapshot, entries: snapshot.entries.filter(entry => entry.id !== data.id) };
      return { ...snapshot, categories: [
        ...snapshot.categories.filter(category => categoryKey(category) !== categoryKey(data)),
        { ...snapshot.categories.find(category => categoryKey(category) === categoryKey(data)), name: data.name, type: data.type, hidden: data.hidden, ...(data.icon !== undefined ? {icon:data.icon} : {}) },
      ] };
    },
    prepare: (snapshot, data) => ({ operationId: crypto.randomUUID(), revision: snapshot.revision, data }),
    save: async command => {
      const result = await commitFinance(command, true, expectedOwner);
      if (!result.success) throw new BackgroundSaveError(result.message, result.status, result.status === "conflict" ? result.snapshot : undefined);
      if (result.acknowledgedOperationId !== command.operationId) throw new BackgroundSaveError("The save response could not be confirmed. Retry the same change.");
      return result.snapshot;
    },
  });
}
