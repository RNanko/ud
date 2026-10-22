"use client";

import { useBackgroundSave } from "./use-background-save";
import { BackgroundSaveError } from "@/lib/background-save-queue";
import type { NotesCommand, NotesResult, NotesSnapshot } from "@/lib/notes";
import { sameNoteContent } from "@/lib/notes/editor-state";

export type PendingNoteChange = {
  command: NotesCommand;
  status: "sending" | "unknown" | "conflict" | "rejected";
  message: string;
  latest?: NotesSnapshot;
};

class NotesReadOnlyError extends BackgroundSaveError {}

function reorderSnapshot(snapshot: NotesSnapshot, pinned: boolean, ids: string[]): NotesSnapshot {
  const group = snapshot.notes
    .filter(note => note.pinned === pinned)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const present = new Set(group.map(note => note.id));
  const requested = new Set(ids);
  const orderedIds = [
    ...ids.filter(id => present.has(id)),
    ...group.filter(note => !requested.has(note.id)).map(note => note.id),
  ];
  const positions = new Map<string, number>(orderedIds.map((id, index) => [id, index]));

  return {
    ...snapshot,
    notes: snapshot.notes.map(note => {
      const position = note.pinned === pinned ? positions.get(note.id) : undefined;
      return position === undefined ? note : { ...note, position };
    }),
  };
}

export function useNotesMutation(initial: NotesSnapshot, commit: (command: NotesCommand) => Promise<NotesResult>, owner?: string) {
  const background = useBackgroundSave<NotesSnapshot, NotesCommand["data"], NotesCommand>(initial, {
    owner,
    reduce: (snapshot, data) => data.kind === "reorder" ? reorderSnapshot(snapshot, data.pinned, data.ids) : snapshot,
    prepare: (snapshot, data) => ({ operationId: crypto.randomUUID(), revision: snapshot.revision, data }),
    apply: () => {},
    save: async command => {
      let result: NotesResult;
      try { result = await commit(command); }
      catch { throw new BackgroundSaveError("We couldn't confirm this change. Keep this page open and retry the same change."); }
      if (!result.success) {
        if (result.status === "rejected" && result.readOnly) throw new NotesReadOnlyError(result.message, "rejected");
        throw new BackgroundSaveError(result.message, result.status, result.status === "conflict" ? result.snapshot : undefined);
      }
      if (result.acknowledgedOperationId !== command.operationId) throw new BackgroundSaveError("The save response could not be confirmed. Retry the same change.");
      if (command.data.kind === "save") {
        const data = command.data;
        const saved = result.snapshot.notes.find(note => note.id === data.id);
        // A durable receipt can acknowledge an earlier edit which has since
        // changed elsewhere. Preserve the draft for explicit conflict review.
        if (!saved || !sameNoteContent(saved, data)) throw new BackgroundSaveError(saved
          ? "Your change was saved, then this note changed again elsewhere. Review the latest version; your draft is kept."
          : "Your change was saved, then this note was deleted elsewhere. Your draft is kept.", "conflict", result.snapshot);
      }
      return result.snapshot;
    },
  });
  const { queue, snapshot, count, phase, failure, head } = background;
  const pending: PendingNoteChange | null = head?.command ? {
    command: head.command,
    status: failure?.status ?? "sending",
    message: failure?.message ?? "Saving…",
    latest: failure?.snapshot,
  } : null;
  async function run(data: NotesCommand["data"]) {
    const state = queue.getState();
    // Position changes do not alter note content revisions. Let the user keep
    // working while they save; prepare the next command at the confirmed board
    // revision when it reaches the front of the queue.
    if (state.count && (state.phase === "failed" || !state.inputs.every(input => input.kind === "reorder"))) throw Error("Resolve the pending note change first.");
    return queue.enqueue(data);
  }
  async function retry() {
    if (phase !== "failed" || failure?.status === "conflict") return;
    return queue.retry();
  }
  function discard() {
    queue.discard();
  }
  return { snapshot, pending, run, retry, discard, readOnly: failure instanceof NotesReadOnlyError, reordering: count > 0 && phase === "saving" && background.inputs.every(input => input.kind === "reorder") };
}
