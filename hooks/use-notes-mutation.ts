"use client";

import { useRef, useState } from "react";
import type { NotesCommand, NotesResult, NotesSnapshot } from "@/lib/notes";
import { sameNoteContent } from "@/lib/notes/editor-state";

export type PendingNoteChange = {
  command: NotesCommand;
  status: "sending" | "unknown" | "conflict" | "rejected";
  message: string;
  latest?: NotesSnapshot;
};

export function useNotesMutation(initial: NotesSnapshot, commit: (command: NotesCommand) => Promise<NotesResult>) {
  const [snapshot, setSnapshot] = useState(initial);
  const latest = useRef(initial);
  const active = useRef<PendingNoteChange | null>(null);
  const [pending, setPending] = useState<PendingNoteChange | null>(null);
  const sending = useRef(false);

  function remember(change: PendingNoteChange | null) {
    active.current = change;
    setPending(change);
  }
  function apply(next: NotesSnapshot) {
    latest.current = next;
    setSnapshot(next);
  }
  async function send(command: NotesCommand): Promise<NotesSnapshot> {
    if (sending.current) throw Error("Please wait for the current note change.");
    sending.current = true;
    remember({ command, status: "sending", message: "Saving…" });
    try {
      let result: NotesResult;
      try { result = await commit(command); }
      catch { result = { success: false, status: "unknown", message: "We couldn't confirm this change. Keep this page open and retry the same change." }; }
      if (result.success) {
        if (result.acknowledgedOperationId !== command.operationId) throw Error("The save response could not be confirmed. Retry the same change.");
        if (command.data.kind === "save") {
          const data = command.data;
          const saved = result.snapshot.notes.find(note => note.id === data.id);
          // A receipt acknowledges the earlier commit, but its current snapshot
          // may include an intervening edit/delete. Never rebase a newer local
          // draft onto that revision without the user's explicit review.
          if (!saved || !sameNoteContent(saved, data)) {
            const message = saved ? "Your change was saved, then this note changed again elsewhere. Review the latest version; your draft is kept." : "Your change was saved, then this note was deleted elsewhere. Your draft is kept.";
            apply(result.snapshot);
            remember({ command, status: "conflict", message, latest: result.snapshot });
            throw Error(message);
          }
        }
        apply(result.snapshot);
        remember(null);
        return result.snapshot;
      }
      if (result.status === "conflict") {
        apply(result.snapshot);
        remember({ command, status: "conflict", message: result.message, latest: result.snapshot });
      } else remember({ command, status: result.status, message: result.message });
      throw Error(result.message);
    } finally {
      if (active.current?.status === "sending") remember({ command, status: "unknown", message: "The outcome is uncertain. Retry the same change to confirm it safely." });
      sending.current = false;
    }
  }
  async function run(data: NotesCommand["data"]) {
    if (active.current) throw Error("Resolve the pending note change first.");
    const captured = JSON.parse(JSON.stringify(data)) as NotesCommand["data"];
    return send({ operationId: crypto.randomUUID(), revision: latest.current.revision, data: captured });
  }
  async function retry() {
    const change = active.current;
    if (!change || change.status === "sending" || change.status === "conflict") return;
    return send(change.command);
  }
  function discard() {
    // An ambiguous write may already be committed. Only known rejection/conflict
    // permits abandoning its envelope and preparing a new intention.
    if (active.current?.status === "conflict" || active.current?.status === "rejected") remember(null);
  }
  return { snapshot, pending, run, retry, discard };
}
