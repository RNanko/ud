import { z } from "zod";

export const NOTES_LIMITS = {
  title: 200, blocks: 100, text: 20_000, itemText: 4_000, items: 200,
  totalItems: 1_000, totalText: 100_000, strokesPerDrawing: 300,
  pointsPerStroke: 2_000, totalStrokes: 600, totalPoints: 12_000,
  payloadBytes: 750_000, notes: 1_000, storageBytes: 10 * 1024 * 1024,
} as const;

const nodeId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const notePointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const noteStrokeSchema = z.object({
  id: nodeId, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().min(0.5).max(40),
  tool: z.enum(["pen", "eraser"]), points: z.array(notePointSchema).min(1).max(NOTES_LIMITS.pointsPerStroke),
}).strict();
const itemSchema = z.object({ id: nodeId, text: z.string().max(NOTES_LIMITS.itemText), checked: z.boolean() }).strict();
export const noteBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: nodeId, type: z.literal("text"), text: z.string().max(NOTES_LIMITS.text) }).strict(),
  z.object({ id: nodeId, type: z.enum(["bullet", "numbered", "checklist"]), items: z.array(itemSchema).max(NOTES_LIMITS.items) }).strict(),
  z.object({ id: nodeId, type: z.literal("drawing"), strokes: z.array(noteStrokeSchema).max(NOTES_LIMITS.strokesPerDrawing) }).strict(),
]);
export type NotePoint = z.infer<typeof notePointSchema>;
export type NoteStroke = z.infer<typeof noteStrokeSchema>;
export type NoteBlock = z.infer<typeof noteBlockSchema>;
export type NoteDraft = { title: string; blocks: NoteBlock[] };
export type Note = NoteDraft & { id: string; revision: number; createdAt: string; updatedAt: string; pinned: boolean; position: number };
export type NotesSnapshot = { revision: number; notes: Note[] };

function serializedBytes(value: unknown) {
  let bytes = 0;
  for (const character of JSON.stringify(value)) {
    const point = character.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function noteUsage(blocks: NoteBlock[]) {
  let text = 0, items = 0, strokes = 0, points = 0;
  for (const block of blocks) {
    if (block.type === "text") text += block.text.length;
    else if (block.type === "drawing") { strokes += block.strokes.length; for (const stroke of block.strokes) points += stroke.points.length; }
    else { items += block.items.length; for (const item of block.items) text += item.text.length; }
  }
  return { text, items, strokes, points };
}

export const noteDraftSchema = z.object({ title: z.string().max(NOTES_LIMITS.title), blocks: z.array(noteBlockSchema).max(NOTES_LIMITS.blocks) }).strict().superRefine((draft, ctx) => {
  const usage = noteUsage(draft.blocks), ids = new Set<string>();
  const addId = (id: string) => { if (ids.has(id)) ctx.addIssue({ code: "custom", message: "Each note block, item and stroke needs its own ID." }); ids.add(id); };
  for (const block of draft.blocks) {
    addId(block.id);
    if (block.type === "drawing") block.strokes.forEach(stroke => addId(stroke.id));
    else if (block.type !== "text") block.items.forEach(item => addId(item.id));
  }
  if (usage.text > NOTES_LIMITS.totalText) ctx.addIssue({ code: "custom", message: "This note has too much text. Split it into smaller notes." });
  if (usage.items > NOTES_LIMITS.totalItems) ctx.addIssue({ code: "custom", message: "This note has too many list items." });
  if (usage.strokes > NOTES_LIMITS.totalStrokes || usage.points > NOTES_LIMITS.totalPoints) ctx.addIssue({ code: "custom", message: "This note has too much drawing detail. Start another note." });
  if (serializedBytes(draft) > NOTES_LIMITS.payloadBytes) ctx.addIssue({ code: "custom", message: "This note is too large to save. Split it into smaller notes." });
});

const noteId = z.uuid();
export const notesCommandSchema = z.object({ operationId: z.uuid(), revision, data: z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("save"), id: noteId, expectedRevision: revision.nullable(), title: z.string(), blocks: z.array(noteBlockSchema) }).strict(),
  z.object({ kind: z.literal("delete"), id: noteId, expectedRevision: revision }).strict(),
  z.object({ kind: z.literal("pin"), id: noteId, expectedRevision: revision, pinned: z.boolean() }).strict(),
  z.object({ kind: z.literal("reorder"), pinned: z.boolean(), ids: z.array(noteId).max(NOTES_LIMITS.notes) }).strict(),
]) }).strict().superRefine((command, ctx) => {
  if (command.data.kind === "save") {
    const result = noteDraftSchema.safeParse({ title: command.data.title, blocks: command.data.blocks });
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ["data", ...issue.path] });
  } else if (command.data.kind === "reorder" && new Set(command.data.ids).size !== command.data.ids.length) {
    ctx.addIssue({ code: "custom", message: "Each note must appear exactly once in the order." });
  }
  if (serializedBytes(command) > NOTES_LIMITS.payloadBytes) ctx.addIssue({ code: "custom", message: "This note is too large to save. Split it into smaller notes." });
});
export type NotesCommand = z.infer<typeof notesCommandSchema>;
export type NotesResult =
  | { success: true; acknowledgedOperationId: string; snapshot: NotesSnapshot }
  | { success: false; status: "conflict"; message: string; snapshot: NotesSnapshot }
  | { success: false; status: "unknown" | "rejected"; message: string };

export function notePlainText(note: NoteDraft): string {
  return [note.title, ...note.blocks.flatMap(block => block.type === "text" ? [block.text] : block.type === "drawing" ? [] : block.items.map(item => item.text))].join("\n");
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.position - b.position || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
