"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateNotes } from "@/lib/actions/notes.actions";
import { NoteItem } from "@/types/types";

import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  UniqueIdentifier,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pen, X } from "lucide-react";

import { useEffect, useState } from "react";

export default function NotesBoard({ data }: { data: NoteItem[] }) {
  const [notes, setNotes] = useState<NoteItem[]>(data);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  useEffect(() => {
    const sync = async () => {
      await updateNotes(notes);
    };

    sync();
  }, [notes]);

  useEffect(() => {
    setNotes(data);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  function handleUpdate(updated: NoteItem) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);

    if (!over) return;

    if (active.id === over.id) return;

    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    setNotes((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  function handleDragCancel(event: DragCancelEvent) {
    void event;
    setActiveId(null);
  }

  const activeNote = notes.find((n) => n.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={notes.map((n) => n.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-8">
          {notes.map((note) => (
            <NoteCard
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              key={note.id}
              note={note}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeNote && <NoteOverlay note={activeNote} />}
      </DragOverlay>
    </DndContext>
  );
}

function NoteOverlay({ note }: { note: NoteItem }) {
  return (
    <Card className="rounded-md border bg-accent/70 p-4 h-fit shadow-lg max-w-100">
      <h3 className="text-lg font-semibold wrap-anywhere">{note.event}</h3>

      {note.description && (
        <p className="mt-1 text-md text-white line-clamp-3 wrap-anywhere">
          {note.description}
        </p>
      )}

      {note.date && (
        <span className="mt-2 block text-md text-white">{note.date}</span>
      )}
    </Card>

  );
}


function NoteCard({
  note,
  onDelete,
  onUpdate,
}: {
  note: NoteItem;
  onDelete: (id: string) => void;
  onUpdate: (note: NoteItem) => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: note.id,
  });

  const [editing, setEditing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      // {...(!editing ? attributes : {})}
      // {...(!editing ? listeners : {})}
      className={`
        group relative p-4 h-fit max-w-100 ring-ring hover:ring-6
        transition-[shadow,ring] duration-300
        ${isDragging ? "bg-ring" : "bg-secondary"}
      `}
    >
      {/* GRAB */}
      <div
        {...attributes}
        {...listeners}
        className="lg:hidden group-hover:block absolute -top-2 -left-3 bg-ring
        h-6  w-6 rounded-full hover:cursor-grabbing 
        hover:bg-primary touch-none transition-all duration-300"
      />
      {/* DELETE */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(note.id);
        }}
        className="
          absolute -top-2 -right-3
          lg:opacity-0 group-hover:opacity-100
          active:cursor-grabbing
          transition-opacity
          rounded-full p-1
          bg-red-700
          hover:text-red-500
          cursor-pointer
        "
      >
        <X className="w-4 h-4" />
      </button>

      {/* EDIT */}
      {!editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="
            absolute top-6 -right-3
            bg-ring
            lg:opacity-0 group-hover:opacity-100
            transition-opacity
            rounded-full p-1
            hover:text-green-500
            cursor-pointer
          "
        >
          <Pen className="w-4 h-4" />
        </button>
      )}

      {/* VIEW MODE */}
      {!editing && (
        <>
          <h3 className="text-lg font-semibold wrap-anywhere">{note.event}</h3>

          {note.description && (
            <p className="mt-1 text-md text-white whitespace-pre-wrap wrap-anywhere">
              {note.description}
            </p>
          )}

          {note.date && (
            <span className="mt-2 block text-md text-white">{note.date}</span>
          )}
        </>
      )}

      {/* EDIT MODE */}
      {editing && (
        <form
          className="flex flex-col gap-3 max-w-100"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);

            onUpdate({
              ...note,
              event: formData.get("event") as string,
              date: (formData.get("date") as string) || undefined,
              description: (formData.get("description") as string) || undefined,
            });

            setEditing(false);
          }}
        >
          <Input name="event" defaultValue={note.event} required autoFocus />

          <Input name="date" type="date" defaultValue={note.date} />

          <Textarea
            name="description"
            defaultValue={note.description}
            className="h-32 resize-none overflow-y-auto"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm">Save</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
