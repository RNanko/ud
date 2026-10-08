"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUserId } from "../session";
import { PublicError, publicErrorMessage } from "../account/errors";
import { NotesWriteError, readNotes, writeNotes } from "../notes/store";
import type { NotesResult, NotesSnapshot } from "../notes";

export async function getNotes(): Promise<NotesSnapshot> {
  const owner = await requireUserId();
  try { return await readNotes(owner); }
  catch { throw new Error("Notes are unavailable right now. Please try again later."); }
}

export async function commitNotes(input: unknown): Promise<NotesResult> {
  let owner: string;
  try { owner = await requireUserId(undefined, "write"); }
  catch (error) {
    return { success: false, status: "rejected", message: error instanceof PublicError ? publicErrorMessage(error) : "Sign in again or check your membership before saving." };
  }
  try {
    const receipt = await writeNotes(owner, input);
    revalidatePath("/account/notes");
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
