import type { Note, NoteDraft } from "../notes";

export function hasNoteContent(draft: NoteDraft) {
  return !!draft.title.trim() || draft.blocks.some(block => block.type === "text" ? !!block.text.trim() : block.type === "drawing" ? !!block.strokes.length : block.items.some(item => !!item.text.trim() || item.checked));
}

export function needsNoteSave(draft: NoteDraft & { source: Note | null; change: number; saved: number; paused?: number; deleted?: boolean }) {
  return !draft.deleted && draft.change !== draft.saved && draft.paused !== draft.change && (!!draft.source || hasNoteContent(draft));
}

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;

export function sameNoteContent(left: NoteDraft, right: NoteDraft) {
  return left.title === right.title && JSON.stringify(canonical(left.blocks)) === JSON.stringify(canonical(right.blocks));
}
