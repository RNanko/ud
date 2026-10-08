"use client";
import { useRef, useState } from "react";
import type { MoneyResult } from "@/lib/money/types";

type Envelope<D> = { operationId: string; revision: number; data: D };
type Pending<D, S> = { command: Envelope<D>; status: "sending" | "unknown" | "conflict"; message: string; latest?: S };

export function useMoneyMutation<D, S extends { revision: number }>(
  initialRevision: number,
  commit: (command: Envelope<D>) => Promise<MoneyResult<S>>,
  apply: (snapshot: S) => void,
) {
  const revision = useRef(initialRevision);
  const current = useRef<Pending<D, S> | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState<Pending<D, S> | null>(null);
  function remember(value: Pending<D, S> | null) { current.current = value; setPending(value); }
  async function send(command: Envelope<D>) {
    if (inFlight.current) throw Error("Please wait for the current change.");
    inFlight.current = true;
    remember({ command, status: "sending", message: "Confirming your change…" });
    try {
      let result: MoneyResult<S>;
      try { result = await commit(command); }
      catch { result = { success: false, status: "unknown", message: "We could not confirm this change. Retry the same change safely; your draft is kept." }; }
      if (result.success) {
        if (result.acknowledgedOperationId !== command.operationId) throw Error("Unexpected acknowledgement. Retry the original change.");
        revision.current = result.snapshot.revision;
        apply(result.snapshot);
        remember(null);
        return result.snapshot;
      }
      if (result.status === "conflict") {
        revision.current = result.snapshot.revision;
        apply(result.snapshot);
        remember({ command, status: "conflict", latest: result.snapshot, message: result.message });
      } else if (result.status === "rejected") remember(null);
      else remember({ command, status: "unknown", message: result.message });
      throw Error(result.message);
    } finally {
      // An unexpected acknowledgement must also retain the original envelope.
      if (current.current?.status === "sending") remember({ command, status: "unknown", message: "The outcome is uncertain. Retry the original change safely." });
      inFlight.current = false;
    }
  }
  async function run(data: D) {
    if (current.current) throw Error("Resolve the pending change first. Your draft has been kept.");
    // Capture values rather than a mutable form object. Retries must remain byte
    // equivalent even if the caller subsequently changes its local draft object.
    const captured = JSON.parse(JSON.stringify(data)) as D;
    return send({ operationId: crypto.randomUUID(), revision: revision.current, data: captured });
  }
  async function retry() {
    const value = current.current;
    if (!value || value.status === "sending") return;
    // Only an explicit conflict review starts a new operation against the latest
    // revision. An ambiguous response always replays the exact original request.
    const command = value.status === "conflict"
      ? { ...value.command, operationId: crypto.randomUUID(), revision: revision.current }
      : value.command;
    return send(command);
  }
  function discard() {
    if (current.current?.status !== "conflict") return;
    remember(null);
  }
  return { pending, run, retry, discard };
}
