"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlignLeft, List, ListOrdered, ListTodo, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Checkbox } from "@/app/components/ui/checkbox";
import { NOTES_LIMITS, noteDraftSchema, type Note, type NoteBlock, type NoteDraft } from "@/lib/notes";
import NoteDrawing from "./NoteDrawing";
import NoteContent from "./NoteContent";

type ListBlock = Extract<NoteBlock, { type: "bullet" | "numbered" | "checklist" }>;
type Removal = { blockId: string; itemId?: string };
export type NoteEditorProps = {
  note: Note | null;
  draft: NoteDraft;
  onChange: (draft: NoteDraft) => void;
  onClose: () => void;
  status?: "saving" | "saved" | "error" | "conflict";
  message?: string;
  onRetry?: () => void;
  onUseLatest?: () => void;
  onKeepDraft?: () => void;
  blocked?: boolean;
  createdLabel?: string;
  updatedLabel?: string;
  latestNote?: Note;
  keepDraftLabel?: string;
};
const names = { text: "Text", bullet: "Bullets", numbered: "Numbers", checklist: "Checkboxes", drawing: "Drawing" };
const uid = () => crypto.randomUUID();
const emptyItem = () => ({ id: uid(), text: "", checked: false });

export default function NoteEditor({ note, draft, onChange, onClose, status = "saved", message, onRetry, onUseLatest, onKeepDraft, blocked = false, createdLabel, updatedLabel, latestNote, keepDraftLabel = "Save my draft" }: NoteEditorProps) {
  // Persistence owns the draft. An acknowledgement must never reset newer text.
  const live = useRef(draft);
  useLayoutEffect(() => { live.current = draft; }, [draft]);
  const activeBlock = useRef<string | null>(null);
  const pendingFocus = useRef<{ id: string; caret?: number } | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [limitMessage, setLimitMessage] = useState("");

  function change(next: NoteDraft) {
    if (blocked) return;
    const validated = noteDraftSchema.safeParse(next);
    if (!validated.success) {
      pendingFocus.current = null;
      const issue = validated.error.issues[0];
      setLimitMessage(issue?.code === "custom" ? issue.message : "This note has reached its content limit. Remove some content or continue in another note.");
      return;
    }
    setLimitMessage("");
    live.current = next;
    onChange(next);
  }
  function replaceBlock(id: string, update: (block: NoteBlock) => NoteBlock) {
    change({ ...live.current, blocks: live.current.blocks.map(block => block.id === id ? update(block) : block) });
  }
  function focusRef(id: string) {
    return (node: HTMLTextAreaElement | HTMLInputElement | null) => {
      if (node && pendingFocus.current?.id === id) {
        const caret = pendingFocus.current.caret ?? node.value.length;
        pendingFocus.current = null;
        node.focus();
        node.setSelectionRange(caret, caret);
      }
    };
  }
  function addBlock(type: NoteBlock["type"]) {
    const block: NoteBlock = type === "text" ? { id: uid(), type, text: "" } : type === "drawing" ? { id: uid(), type, strokes: [] } : { id: uid(), type, items: [emptyItem()] };
    const blocks = [...live.current.blocks], selected = blocks.findIndex(value => value.id === activeBlock.current);
    blocks.splice(selected < 0 ? blocks.length : selected + 1, 0, block);
    if (type !== "drawing") pendingFocus.current = { id: "items" in block ? block.items[0].id : block.id };
    activeBlock.current = block.id;
    change({ ...live.current, blocks });
  }
  function updateItem(blockId: string, itemId: string, patch: { text?: string; checked?: boolean }) {
    replaceBlock(blockId, block => "items" in block ? { ...block, items: block.items.map(item => item.id === itemId ? { ...item, ...patch } : item) } : block);
  }
  function addItem(blockId: string) {
    const block = live.current.blocks.find(value => value.id === blockId);
    if (!block || !("items" in block)) return;
    if (block.items.length >= NOTES_LIMITS.items) { setLimitMessage("This list is full. Start another list to keep writing."); return; }
    const item = emptyItem();
    pendingFocus.current = { id: item.id };
    replaceBlock(blockId, value => "items" in value ? { ...value, items: [...value.items, item] } : value);
  }
  function listKey(event: KeyboardEvent<HTMLTextAreaElement>, blockId: string, itemId: string) {
    if (blocked || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const blocks = live.current.blocks, index = blocks.findIndex(value => value.id === blockId), block = blocks[index];
    if (!block || !("items" in block)) return;
    const itemIndex = block.items.findIndex(item => item.id === itemId), item = block.items[itemIndex];
    if (!item) return;
    if (item.text === "") {
      const before = block.items.slice(0, itemIndex), after = block.items.slice(itemIndex + 1);
      const paragraph: NoteBlock = { id: uid(), type: "text", text: "" };
      const replacement: NoteBlock[] = [
        ...(before.length ? [{ ...block, items: before }] : []), paragraph,
        ...(after.length ? [{ ...block, id: before.length ? uid() : block.id, items: after }] : []),
      ];
      pendingFocus.current = { id: paragraph.id, caret: 0 };
      activeBlock.current = paragraph.id;
      change({ ...live.current, blocks: [...blocks.slice(0, index), ...replacement, ...blocks.slice(index + 1)] });
      return;
    }
    if (block.items.length >= NOTES_LIMITS.items) { setLimitMessage("This list is full. Start another list to keep writing."); return; }
    const start = event.currentTarget.selectionStart ?? item.text.length, end = event.currentTarget.selectionEnd ?? start;
    const next = { ...emptyItem(), text: item.text.slice(end) };
    pendingFocus.current = { id: next.id, caret: 0 };
    replaceBlock(blockId, value => "items" in value ? { ...value, items: [...value.items.slice(0, itemIndex), { ...item, text: item.text.slice(0, start) }, next, ...value.items.slice(itemIndex + 1)] } : value);
  }
  function remove(target: Removal) {
    const originalIndex = live.current.blocks.findIndex(block => block.id === target.blockId);
    const blocks = live.current.blocks.flatMap(block => {
      if (block.id !== target.blockId) return [block];
      if (!target.itemId || !("items" in block)) return [];
      const items = block.items.filter(item => item.id !== target.itemId);
      return items.length ? [{ ...block, items }] : [];
    });
    const remaining = blocks.find(block => block.id === target.blockId) ?? blocks[Math.min(originalIndex, blocks.length - 1)];
    pendingFocus.current = { id: remaining?.type === "text" ? remaining.id : remaining && "items" in remaining ? remaining.items[0]?.id ?? "note-title" : "note-title" };
    change({ ...live.current, blocks });
    setRemoval(null);
  }
  function requestRemoval(target: Removal) {
    const block = live.current.blocks.find(value => value.id === target.blockId);
    if (!block) return;
    const hasContent = target.itemId && "items" in block ? block.items.some(item => item.id === target.itemId && (item.text.length > 0 || item.checked)) : block.type === "text" ? block.text.length > 0 : block.type === "drawing" ? block.strokes.length > 0 : block.items.some(item => item.text.length > 0 || item.checked);
    if (hasContent) setRemoval(target); else remove(target);
  }
  function renderList(block: ListBlock) {
    const ListTag = block.type === "numbered" ? "ol" : "ul";
    return <>
      <ListTag className="space-y-2">
        {block.items.map((item, index) => <li key={item.id} className="flex min-w-0 items-start gap-2">
          {block.type === "checklist" ? <span className="flex h-11 w-8 shrink-0 items-center justify-center"><Checkbox disabled={blocked} checked={item.checked} onCheckedChange={checked => updateItem(block.id, item.id, { checked: checked === true })} aria-label={`Complete checklist item ${index + 1}`} className="size-5" /></span> : <span aria-hidden="true" className="w-8 shrink-0 pt-3 text-center text-sm tabular-nums text-muted-foreground">{block.type === "numbered" ? `${index + 1}.` : "•"}</span>}
          <Textarea ref={focusRef(item.id)} aria-label={`${names[block.type]} item ${index + 1}`} disabled={blocked} value={item.text} maxLength={NOTES_LIMITS.itemText} rows={1} placeholder="List item" onFocus={() => { activeBlock.current = block.id; }} onChange={event => updateItem(block.id, item.id, { text: event.target.value })} onKeyDown={event => listKey(event, block.id, item.id)} className={`min-h-11 min-w-0 resize-y whitespace-pre-wrap break-words bg-card dark:bg-card dark:border-border ${item.checked && block.type === "checklist" ? "text-muted-foreground line-through" : ""}`} />
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" disabled={blocked} aria-label={`Remove ${names[block.type].toLowerCase()} item ${index + 1}`} onClick={() => requestRemoval({ blockId: block.id, itemId: item.id })}><X size={16} /></Button>
        </li>)}
      </ListTag>
      <div className="mt-2 flex justify-center"><Button type="button" variant="ghost" size="icon" disabled={blocked} className="size-11 text-muted-foreground" aria-label="Add item" onClick={() => addItem(block.id)}><Plus size={16} /></Button></div>
    </>;
  }
  const saveLabel = status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : status === "conflict" ? "Review the latest version" : "Changes could not be saved";

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] min-h-0 flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[min(48rem,90dvh)] sm:w-[min(48rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <Dialog.Title className="sr-only">{note ? "Edit note" : "New note"}</Dialog.Title>
        <Dialog.Description className="sr-only">Write text, lists and drawings. Your changes save automatically. Enter adds a list item; Enter on an empty item returns to text. Shift and Enter add a new line.</Dialog.Description>
        <header className="shrink-0 border-b border-border p-4 pb-3 sm:px-6 sm:pt-5">
          <div className="flex items-start gap-3">
            <Input ref={focusRef("note-title")} autoFocus aria-label="Note title" placeholder="Untitled note" maxLength={NOTES_LIMITS.title} value={draft.title} disabled={blocked} onFocus={() => { activeBlock.current = null; }} onChange={event => change({ ...live.current, title: event.target.value })} className="h-12 min-w-0 border-transparent bg-transparent px-4 text-xl font-semibold shadow-none dark:bg-transparent md:text-xl" />
            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Close note" onClick={onClose}><X size={20} /></Button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Created {createdLabel ?? "Not saved yet"}</span><span>Modified {updatedLabel ?? "Not saved yet"}</span></div>
        </header>
        <div role="group" aria-label="Add note content" className="flex shrink-0 flex-wrap gap-1 border-b border-border px-3 py-2 sm:px-5">
          {([["text", AlignLeft, "Text"], ["bullet", List, "Bullets"], ["numbered", ListOrdered, "Numbers"], ["checklist", ListTodo, "Checkboxes"], ["drawing", Pencil, "Draw"]] as const).map(([type, Icon, label]) => <Button key={type} type="button" variant="ghost" disabled={blocked} className="h-11 gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm" onClick={() => addBlock(type)} aria-label={`Add ${label.toLowerCase()} block`}><Icon size={16} />{label}</Button>)}
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {status === "conflict" && latestNote && <section aria-label="Latest saved version" className="rounded-xl border border-orange-400/40 bg-orange-400/5 p-3"><h3 className="text-xs font-semibold text-muted-foreground">Latest saved version</h3><p className="mt-1 break-words font-medium">{latestNote.title || "Untitled note"}</p><div className="mt-2 max-h-40 overflow-y-auto overscroll-contain rounded-lg"><NoteContent blocks={latestNote.blocks} disabled /></div></section>}
          {status === "conflict" && <h3 className="text-sm font-semibold">Your draft</h3>}
          {draft.blocks.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Start with text, a list or a drawing above.</p>}
          {draft.blocks.map((block, index) => <section key={block.id} aria-label={`${names[block.type]} block ${index + 1}`} onFocusCapture={() => { activeBlock.current = block.id; }} className="min-w-0 rounded-xl border border-border bg-card/30 p-3">
            <div className="mb-2 flex justify-end"><Button type="button" variant="ghost" size="icon" className="size-11 rounded-full border-transparent text-muted-foreground hover:border-transparent" disabled={blocked} aria-label={`Remove ${names[block.type].toLowerCase()} block ${index + 1}`} onClick={() => requestRemoval({ blockId: block.id })}><X size={16} /></Button></div>
            {block.type === "text" ? <Textarea ref={focusRef(block.id)} aria-label={`Text block ${index + 1}`} placeholder="Write something…" disabled={blocked} value={block.text} maxLength={NOTES_LIMITS.text} rows={3} onChange={event => replaceBlock(block.id, value => value.type === "text" ? { ...value, text: event.target.value } : value)} className="min-h-28 min-w-0 resize-y whitespace-pre-wrap break-words bg-card dark:bg-card dark:border-border" /> : block.type === "drawing" ? <NoteDrawing key={block.id} strokes={block.strokes} onChange={strokes => replaceBlock(block.id, value => value.type === "drawing" ? { ...value, strokes } : value)} readOnly={blocked} maxPoints={Math.max(0, NOTES_LIMITS.totalPoints - draft.blocks.reduce((sum, other) => sum + (other.type === "drawing" && other.id !== block.id ? other.strokes.reduce((count, stroke) => count + stroke.points.length, 0) : 0), 0))} maxStrokes={Math.min(NOTES_LIMITS.strokesPerDrawing, Math.max(0, NOTES_LIMITS.totalStrokes - draft.blocks.reduce((sum, other) => sum + (other.type === "drawing" && other.id !== block.id ? other.strokes.length : 0), 0)))} /> : renderList(block)}
            {removal?.blockId === block.id && <div role="alert" className="mt-3 rounded-lg border border-border bg-background p-3"><p className="text-sm">Remove {removal.itemId ? "this item" : "this block and its contents"}?</p><div className="mt-2 flex gap-2"><Button type="button" variant="outline" className="h-11" onClick={() => setRemoval(null)}>Keep</Button><Button type="button" variant="destructive" className="h-11" disabled={blocked} onClick={() => remove(removal)}>Remove</Button></div></div>}
          </section>)}
        </div>
        <footer className="shrink-0 border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <p role={status === "error" || status === "conflict" ? "alert" : "status"} className={`flex min-h-5 items-center gap-2 text-sm ${status === "error" || status === "conflict" ? "text-orange-400" : "text-muted-foreground"}`}>{status === "saving" && <LoaderCircle aria-hidden="true" size={16} className="shrink-0 animate-spin text-primary motion-reduce:animate-none" />}<span>{message || saveLabel}</span></p>
          {limitMessage && <p role="alert" className="mt-1 text-sm text-orange-400">{limitMessage}</p>}
          {status === "error" && <div className="mt-2 flex flex-wrap gap-2">{onRetry && <Button type="button" variant="outline" className="h-11" onClick={onRetry}>Retry saving</Button>}{onUseLatest && <Button type="button" variant="outline" className="h-11" onClick={onUseLatest}>Edit my draft</Button>}</div>}
          {status === "conflict" && <div className="mt-2 flex flex-wrap gap-2">{onUseLatest && <Button type="button" variant="outline" className="h-11" onClick={onUseLatest}>Use latest version</Button>}{onKeepDraft && <Button type="button" className="h-11" onClick={onKeepDraft}>{keepDraftLabel}</Button>}</div>}
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
