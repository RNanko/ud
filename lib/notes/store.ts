import "server-only";
import { createHash } from "node:crypto";
import { accountSql } from "../account/store";
import { notesCommandSchema, type NotesSnapshot } from "../notes";

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;

export class NotesWriteError extends Error {
  constructor(readonly kind: "conflict" | "rejected", message: string) { super(message); }
}

export async function readNotes(owner: string): Promise<NotesSnapshot> {
  const [row] = await accountSql`SELECT
    COALESCE((SELECT revision FROM b1_notes_state WHERE user_id=${owner}),0)::text AS revision,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'blocks',n.blocks,'revision',n.revision,
      'createdAt',to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt',to_char(n.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'pinned',n.pinned,'position',n.position)
      ORDER BY n.pinned DESC,n.position,n.created_at DESC,n.id) FROM b1_notes n WHERE n.user_id=${owner}),'[]'::jsonb) AS notes`;
  const revision = Number(row?.revision);
  if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(row.notes) || row.notes.some(note => !Number.isSafeInteger(note.revision))) throw Error("Invalid Notes snapshot");
  return { revision, notes: row.notes };
}

export async function writeNotes(owner: string, input: unknown) {
  const command = notesCommandSchema.parse(input);
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical(command))).digest("hex");
  const [row] = await accountSql`SELECT b1_save_note(${owner},${command.operationId}::uuid,${fingerprint},${command.revision},${JSON.stringify(command.data)}::jsonb) AS outcome`;
  const result = row?.outcome;
  if (result?.outcome === "conflict" || result?.outcome === "operation-reused") throw new NotesWriteError("conflict", "This note changed elsewhere. Your draft is kept. Review the latest saved version before trying again.");
  if (result?.outcome === "limit") throw new NotesWriteError("rejected", "You have reached the limit of 1,000 notes. Remove a note before creating another.");
  if (result?.outcome === "storage-limit") throw new NotesWriteError("rejected", "Your notes have reached the 10 MB storage limit. Shorten a note or remove one before adding more content.");
  if (result?.outcome === "unauthorized") throw new NotesWriteError("rejected", "Sign in again to save your notes.");
  if (result?.outcome === "invalid") throw new NotesWriteError("rejected", "Check your note and try again.");
  if (!["saved", "duplicate"].includes(result?.outcome) || !Number.isSafeInteger(Number(result.revision))) throw Error("Note was not acknowledged");
  return { acknowledgedOperationId: command.operationId, revision: Number(result.revision) };
}
