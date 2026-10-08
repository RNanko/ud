"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle, NotebookPen, Pencil, Pin, PinOff, Plus } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { formatAccountTimestamp } from "@/lib/account/format";
import { commitNotes } from "@/lib/actions/notes.actions";
import type { Note, NoteBlock, NoteDraft, NotesCommand, NotesResult, NotesSnapshot } from "@/lib/notes";
import { useNotesMutation } from "@/hooks/use-notes-mutation";
import { hasNoteContent, needsNoteSave } from "@/lib/notes/editor-state";
import NoteContent from "./NoteContent";
import NoteEditor from "./NoteEditor";
import HoldDeleteButton from "../finance/HoldDeleteButton";
import styles from "./notes.module.css";

type EditSession = NoteDraft & { id: string; source: Note | null; change: number; saved: number; deleted?: boolean; paused?: number };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export default function NotesClient({ initial, commit = commitNotes }: { initial: NotesSnapshot; commit?: (command: NotesCommand) => Promise<NotesResult> }) {
  const mutation = useNotesMutation(initial, commit);
  const { run: runMutation } = mutation;
  const { settings } = useAccountPreferences();
  const [editor, setEditor] = useState<EditSession | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const capturedSave = useRef<{ id: string; change: number } | null>(null);
  const pending = mutation.pending;
  const notes = mutation.snapshot.notes;
  const pinned = notes.filter(note => note.pinned).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const ordinary = notes.filter(note => !note.pinned).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 240, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const timestamp = (value: string) => formatAccountTimestamp(value, settings.preferences);

  const acknowledgeSave = useCallback((snapshot: NotesSnapshot, captured: { id: string; change: number } | null) => {
    if (!captured) return;
    const saved = snapshot.notes.find(note => note.id === captured.id);
    setEditor(current => {
      if (current?.id !== captured.id) return current;
      if (!saved) return { ...current, deleted: true };
      return { ...current, source: saved, saved: Math.max(current.saved, captured.change), deleted: false };
    });
  }, []);

  const saveEditor = useCallback(async (value: EditSession) => {
    const captured = { id: value.id, change: value.change };
    capturedSave.current = captured;
    const snapshot = await runMutation({ kind: "save", id: value.id, expectedRevision: value.source?.revision ?? null, title: value.title, blocks: value.blocks });
    acknowledgeSave(snapshot, captured);
    return snapshot;
  }, [runMutation, acknowledgeSave]);

  useEffect(() => {
    if (!editor || pending || !needsNoteSave(editor)) return;
    const timer = setTimeout(() => { void saveEditor(editor).catch(() => {}); }, 700);
    return () => clearTimeout(timer);
  }, [editor, pending, saveEditor]);

  useEffect(() => {
    if (!pending && (!editor || editor.change === editor.saved)) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pending, editor]);

  function open(note?: Note) {
    if (pending) { setNotice("Resolve the pending change before opening another note."); return; }
    setNotice("");
    setEditor(note
      ? { id: note.id, source: note, title: note.title, blocks: copy(note.blocks), change: 0, saved: 0 }
      : { id: crypto.randomUUID(), source: null, title: "", blocks: [{ id: crypto.randomUUID(), type: "text", text: "" }], change: 0, saved: 0 });
  }
  function changeDraft(draft: NoteDraft) {
    setEditor(current => current ? { ...current, ...draft, change: current.change + 1 } : current);
    setNotice("");
  }
  async function closeEditor() {
    if (!editor) return;
    if (pending || editor.deleted) { setNotice("Your draft is kept. Resolve this change before closing the editor."); return; }
    const captured = editor;
    if (editor.change !== editor.saved && (editor.source || hasNoteContent(editor))) {
      try { await saveEditor(editor); }
      catch { return; }
    }
    setEditor(current => current?.id === captured.id && current.change === captured.change ? null : current);
    setNotice("");
  }
  async function retry() {
    const captured = capturedSave.current;
    try {
      const snapshot = await mutation.retry();
      if (snapshot) {
        if (pending?.command.data.kind === "save") acknowledgeSave(snapshot, captured);
        setNotice("");
      }
    } catch { /* The pending envelope and draft remain visible. */ }
  }
  function useLatest() {
    if (!pending && editor?.deleted) { setEditor(null); setNotice(""); return; }
    if (!pending || !["conflict", "rejected"].includes(pending.status)) return;
    const data = pending.command.data;
    mutation.discard();
    if (data.kind === "save" && editor?.id === data.id) {
      const latest = mutation.snapshot.notes.find(note => note.id === data.id);
      setEditor(latest ? { id: latest.id, source: latest, title: latest.title, blocks: copy(latest.blocks), change: 0, saved: 0 } : null);
    }
    setNotice("");
  }
  function keepDraft() {
    if (!pending || pending.status !== "conflict") return;
    const data = pending.command.data;
    const latest = "id" in data ? mutation.snapshot.notes.find(note => note.id === data.id) : null;
    if (data.kind === "save" && editor?.id === data.id) {
      if (!latest && data.expectedRevision !== null) return;
      mutation.discard();
      setEditor(current => current ? { ...current, source: latest ?? null, change: current.change + 1 } : current);
      return;
    }
    mutation.discard();
    let reviewed: NotesCommand["data"] | null = null;
    if (data.kind === "pin" && latest) reviewed = { ...data, expectedRevision: latest.revision };
    if (data.kind === "delete") { setNotice("Review the latest note, then hold its trash icon again to delete it."); return; }
    if (data.kind === "save" && latest) reviewed = { ...data, expectedRevision: latest.revision };
    if (data.kind === "reorder") {
      const group = mutation.snapshot.notes.filter(note => note.pinned === data.pinned).sort((a, b) => a.position - b.position);
      const wanted = data.ids.filter(id => group.some(note => note.id === id));
      reviewed = { ...data, ids: [...wanted, ...group.filter(note => !wanted.includes(note.id)).map(note => note.id)] };
    }
    if (reviewed) void mutation.run(reviewed).catch(() => {});
  }
  function editRejected() {
    if (pending?.status === "rejected") {
      mutation.discard();
      setEditor(current => current ? { ...current, paused: current.change } : current);
    }
  }
  function saveAsNew() {
    if (pending?.status === "conflict" || pending?.status === "rejected") mutation.discard();
    setEditor(current => current ? { ...current, id: crypto.randomUUID(), source: null, deleted: false, change: 1, saved: 0 } : current);
    setNotice("");
  }
  function reorder(group: Note[], from: number, to: number) {
    if (pending || from === to || to < 0 || to >= group.length) return;
    void mutation.run({ kind: "reorder", pinned: group[0].pinned, ids: arrayMove(group.map(note => note.id), from, to) }).catch(() => {});
  }
  function drop(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const active = notes.find(note => note.id === event.active.id);
    const target = notes.find(note => note.id === event.over?.id);
    if (!active || !target || active.pinned !== target.pinned) return;
    const group = active.pinned ? pinned : ordinary;
    reorder(group, group.findIndex(note => note.id === active.id), group.findIndex(note => note.id === target.id));
  }
  function toggle(note: Note, blockId: string, itemId: string) {
    if (pending) return;
    const blocks = note.blocks.map(block => block.id === blockId && block.type === "checklist"
      ? { ...block, items: block.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item) }
      : block);
    void mutation.run({ kind: "save", id: note.id, expectedRevision: note.revision, title: note.title, blocks }).catch(() => {});
  }
  const pendingData = pending?.command.data;
  const latestPending = pendingData && "id" in pendingData ? notes.find(note => note.id === pendingData.id) : null;
  const wasDeleted = !!editor?.deleted || pending?.status === "conflict" && pendingData?.kind === "save" && pendingData.expectedRevision !== null && !latestPending;
  const editorStatus = wasDeleted ? "conflict" : pending?.status === "sending" ? "saving" : pending?.status === "conflict" ? "conflict" : pending ? "error" : editor && editor.paused === editor.change ? "error" : editor && needsNoteSave(editor) ? "saving" : "saved";
  const editorMessage = wasDeleted ? "This note was deleted elsewhere. Your draft is kept; you can save it as a separate new note." : notice || pending?.message;
  const activeNote = notes.find(note => note.id === activeId);
  const callbacks = (note: Note, group: Note[], index: number) => ({
    onEdit: () => open(note),
    onPin: () => { void mutation.run({ kind: "pin", id: note.id, expectedRevision: note.revision, pinned: !note.pinned }).catch(() => {}); },
    onDelete: async () => { await mutation.run({ kind: "delete", id: note.id, expectedRevision: note.revision }); },
    onMove: (direction: number) => reorder(group, index, index + direction),
    onToggle: (blockId: string, itemId: string) => toggle(note, blockId, itemId),
    canMoveUp: index > 0, canMoveDown: index < group.length - 1,
  });
  const renderGroup = (group: Note[], title: string) => <section aria-label={title} className="space-y-4">
    <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{title === "Pinned notes" && <Pin size={15} />}{title} <span className="text-xs">{group.length}</span></h2>
    <SortableContext items={group.map(note => note.id)} strategy={rectSortingStrategy}>
      <div className={styles.board}>{group.map((note, index) => <SortableNote key={note.id} note={note} disabled={!!pending} {...callbacks(note, group, index)} />)}</div>
    </SortableContext>
  </section>;

  return <section aria-label="Notes workspace" className="mx-auto max-w-6xl space-y-7 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground"><NotebookPen size={14} />Ideas worth keeping</p>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl">Notes</h1>
          <span role="status" aria-atomic="true" className="flex size-5 shrink-0 items-center justify-center">
            {pending?.status === "sending" && !editor && <><LoaderCircle aria-hidden="true" size={20} className="animate-spin text-primary motion-reduce:animate-none" /><span className="sr-only">Saving notes</span></>}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Keep your thoughts, lists, and sketches together.</p>
      </div>
      <Button className="h-11 rounded-xl" disabled={!!pending || !!editor} onClick={() => open()}><Plus />New note</Button>
    </header>
    {notice && !editor && <p role="status" className="rounded-2xl border border-border bg-card p-4 text-sm">{notice}</p>}
    {pending && pending.status !== "sending" && !editor && <section role="status" aria-label="Note save status" className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <p>{pending.message}</p>
      {pending.status === "unknown" && <p>Keep this page open until the change is confirmed.</p>}
      {pending.status === "conflict" && latestPending && <p>Latest saved note: {latestPending.title || "Untitled note"}</p>}
      <div className="flex flex-wrap gap-2">
        {(pending.status === "unknown" || pending.status === "rejected") && <Button variant="outline" onClick={() => { void retry(); }}>Retry the same change</Button>}
        {pending.status === "conflict" && <Button variant="outline" onClick={keepDraft}>{pendingData?.kind === "delete" ? "Review latest note" : "Apply my change after review"}</Button>}
        {(pending.status === "conflict" || pending.status === "rejected") && <Button variant="ghost" onClick={useLatest}>Use latest saved notes</Button>}
      </div>
    </section>}
    {!notes.length && <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center"><NotebookPen size={36} className="text-primary" /><div><h2 className="text-xl font-medium">A place for your next idea</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Write something down, make a checklist, or sketch it by hand.</p></div><Button variant="outline" disabled={!!pending || !!editor} onClick={() => open()}><Plus />Create your first note</Button></div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => setActiveId(String(event.active.id))} onDragEnd={drop} onDragCancel={() => setActiveId(null)} accessibility={{ screenReaderInstructions: { draggable: "Use a note's drag handle. Press Space to pick it up, arrow keys to move, Space to drop, or Escape to cancel. You can also use the Move earlier or Move later buttons on its card." } }}>
      <div className="space-y-4">{!!notes.length && <p className="text-xs text-muted-foreground">Drag the grip to reorder notes. Hold a trash icon to delete.</p>}<div className="space-y-8">{!!pinned.length && renderGroup(pinned, "Pinned notes")}{!!ordinary.length && renderGroup(ordinary, "All notes")}</div></div>
      <DragOverlay adjustScale={false} dropAnimation={null}>{activeNote && <div className={styles.preview} aria-hidden="true" inert><NoteCard note={activeNote} disabled overlay /></div>}</DragOverlay>
    </DndContext>
    {editor && <NoteEditor note={editor.source} draft={{ title: editor.title, blocks: editor.blocks }} onChange={changeDraft} onClose={() => { void closeEditor(); }} status={editorStatus} message={editorMessage} blocked={!!pending && pending.status !== "sending" || wasDeleted} createdLabel={editor.source ? timestamp(editor.source.createdAt) : "Not saved yet"} updatedLabel={editor.source ? timestamp(editor.source.updatedAt) : "Not saved yet"} latestNote={pending?.status === "conflict" ? latestPending ?? undefined : undefined} keepDraftLabel={wasDeleted ? "Save as new note" : "Save my draft after review"} onRetry={() => { if (!pending) void saveEditor(editor).catch(() => {}); else void retry(); }} onUseLatest={pending?.status === "unknown" ? undefined : pending?.status === "rejected" ? editRejected : useLatest} onKeepDraft={wasDeleted ? saveAsNew : keepDraft} />}
  </section>;
}

type CardProps = { note: Note; disabled?: boolean; overlay?: boolean; onEdit?: () => void; onPin?: () => void; onDelete?: () => Promise<void>; onMove?: (direction: number) => void; onToggle?: (blockId: string, itemId: string) => void; canMoveUp?: boolean; canMoveDown?: boolean; grip?: React.ReactNode; style?: CSSProperties; dragging?: boolean };

function preferredWidth(blocks: NoteBlock[], title: string) {
  const lines = [title, ...blocks.flatMap(block => block.type === "text" ? block.text.split("\n") : block.type === "drawing" ? ["".padEnd(43)] : block.items.flatMap(item => item.text.split("\n")))];
  return Math.max(240, Math.min(420, Math.max(...lines.map(line => Math.min(line.length, 60))) * 7 + 64));
}

function SortableNote(props: CardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: props.note.id, disabled: props.disabled });
  return <div ref={setNodeRef} className={styles.slot} style={{ "--note-width": `${preferredWidth(props.note.blocks, props.note.title)}px`, transform: CSS.Translate.toString(transform), transition } as CSSProperties}>
    <NoteCard {...props} dragging={isDragging} grip={<Button ref={setActivatorNodeRef} {...attributes} {...listeners} size="icon" variant="ghost" disabled={props.disabled} aria-label={`Reorder ${props.note.title || "untitled note"}`} className={`size-10 shrink-0 rounded-xl border-transparent ${styles.grip}`}><GripVertical size={17} /></Button>} />
  </div>;
}

function NoteCard({ note, disabled, overlay, onEdit, onPin, onDelete, onMove, onToggle, canMoveUp, canMoveDown, grip, dragging }: CardProps) {
  return <Card className={`${styles.card} ${!disabled && !overlay ? "cursor-pointer" : ""} ${dragging ? styles.dragging : ""} ${overlay ? styles.overlay : ""}`} style={{ "--note-width": `${preferredWidth(note.blocks, note.title)}px` } as CSSProperties} onClick={event => {
    if (disabled || overlay || dragging || event.defaultPrevented) return;
    if (!(event.target instanceof Element) || event.target.closest("button, input, a, label, [role='button'], [role='checkbox']")) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && (event.currentTarget.contains(selection.anchorNode) || event.currentTarget.contains(selection.focusNode))) return;
    onEdit?.();
  }}>
    <div className={styles.header}><div className="flex items-start gap-1">{grip || <span className="flex size-10 shrink-0 items-center justify-center text-muted-foreground"><GripVertical size={17} /></span>}<button type="button" disabled={disabled} onClick={onEdit} className="min-w-0 flex-1 rounded-lg px-1 py-2 text-left font-semibold leading-6 wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring">{note.title || "Untitled note"}</button><Button size="icon" variant="ghost" className="size-10 shrink-0 rounded-xl border-transparent" disabled={disabled} aria-label={note.pinned ? "Unpin note" : "Pin note"} aria-pressed={note.pinned} onClick={onPin}>{note.pinned ? <Pin className="text-primary" size={17} /> : <PinOff size={17} />}</Button></div></div>
    <div className={styles.body}><NoteContent blocks={note.blocks} disabled={disabled} onToggle={onToggle} /></div>
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border p-3 [&>div]:max-w-full">
      <Button variant="ghost" disabled={disabled} onClick={onEdit} className="h-11 min-w-0 flex-1 px-2 text-xs" aria-label={`Edit ${note.title || "untitled note"}`}><Pencil size={14} /> Edit</Button>
      <Button variant="ghost" size="icon" disabled={disabled || !canMoveUp} onClick={() => onMove?.(-1)} className="size-11" aria-label={`Move ${note.title || "untitled note"} earlier`} title="Move earlier"><ArrowUp size={16} /></Button>
      <Button variant="ghost" size="icon" disabled={disabled || !canMoveDown} onClick={() => onMove?.(1)} className="size-11" aria-label={`Move ${note.title || "untitled note"} later`} title="Move later"><ArrowDown size={16} /></Button>
      {(onDelete || overlay) && <HoldDeleteButton compact label={note.title || "untitled note"} disabled={disabled} onConfirm={onDelete ?? (() => Promise.resolve())} />}
    </div>
  </Card>;
}
