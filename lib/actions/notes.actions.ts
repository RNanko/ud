"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "../session";
import { PublicError, publicErrorMessage } from "../account/errors";
import { NotesWriteError, readNotes, writeNotes } from "../notes/store";
import type { NotesResult, NotesSnapshot } from "../notes";
import { notesCommandSchema } from "../notes";

export async function getNotes(): Promise<NotesSnapshot> {
  const owner = await requireUserId();
  try { return await readNotes(owner); }
  catch { throw new Error("Notes are unavailable right now. Please try again later."); }
}

export async function commitNotes(input: unknown, responseOnly = false, expectedOwner?: string): Promise<NotesResult> {
  let owner: string;
  let command;
  try {
    if (responseOnly && !expectedOwner) throw new Error("Sign in again before saving.");
    command = notesCommandSchema.parse(input);
    // Expiry never takes away the ability to delete an owned record. Validate
    // the full command first so an edit cannot masquerade as a deletion.
    owner = await requireUserId(expectedOwner, command.data.kind === "delete" ? "read" : "write");
  }
  catch (error) {
    return { success: false, status: "rejected", message: error instanceof PublicError ? publicErrorMessage(error) : error instanceof ZodError ? "Check your note and try again." : "Sign in again or check your membership before saving.", ...(error instanceof PublicError && error.code === "MEMBERSHIP_READ_ONLY" ? { readOnly: true as const } : {}) };
  }
  try {
    const receipt = await writeNotes(owner, command);
    if (responseOnly) after(() => revalidatePath("/account/notes"));
    else revalidatePath("/account/notes");
    return { success: true, acknowledgedOperationId: receipt.acknowledgedOperationId, snapshot: await readNotes(owner) };
  } catch (error) {
    if (error instanceof NotesWriteError && error.kind === "conflict") {
      try { return { success: false, status: "conflict", message: error.message, snapshot: await readNotes(owner) }; }
      catch { /* The original immutable command remains safe to retry. */ }
    } else if (error instanceof NotesWriteError || error instanceof ZodError) {
      return { success: false, status: "rejected", message: error instanceof ZodError ? error.issues[0]?.message || "Check your note." : error.message };
    }
    return { success: false, status: "unknown", message: "We could not confirm this change. Your draft is kept. Retry the same change safely." };
  }
}
