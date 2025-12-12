"use client";
import {
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

interface Item {
  id: string;
  content: string;
}

function SortableItem({
  id,
  content,
}: {
  id: UniqueIdentifier;
  content: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab touch-none rounded-md border p-3 
        active:cursor-grabbing ${
          isDragging ? "z-10 opacity-50 shadow-md" : "bg-black"
        }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-500 dark:text-gray-400">⋮⋮</span>
        <span className="dark:text-gray-200">{content}</span>
      </div>
    </li>
  );
}

export default function Page() {
  const [items, setItems] = useState<Item[]>([
    { id: "1", content: "Item 1" },
    { id: "2", content: "Item 2" },
    { id: "3", content: "Item 3" },
    { id: "4", content: "Item 4" },
    { id: "5", content: "Item 5" },
  ]);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, //
        delay: 100, // small delay
        tolerance: 5, // small movements before activating drag
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragCancel(event: DragCancelEvent) {
    void event;
    setActiveId(null);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-bolde">Sortable List</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {items.map((item) => (
              <SortableItem id={item.id} key={item.id} content={item.content} />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay
          adjustScale={true}
          dropAnimation={{
            duration: 150,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeId ? (
            <div
              className="cursor-grabbing rounded-md border 
            bg-blue-600 p-3 shadow-md"
            >
              {items.find((item) => item.id === activeId)?.content}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// const DEFAULT_CARDS = [
//   { title: "Look into render bug in dashboard", id: "1", column: "backlog" },
//   { title: "SOX compliance checklist", id: "2", column: "backlog" },
//   { title: "[SPIKE] Migrate to Azure", id: "3", column: "backlog" },
//   { title: "Document Notifications service", id: "4", column: "backlog" },

//   { title: "Research DB for new service", id: "5", column: "todo" },
//   { title: "Postmortem for outage", id: "6", column: "todo" },
//   { title: "Sync with product", id: "7", column: "todo" },

//   { title: "Refactor to Zustand", id: "8", column: "doing" },
//   { title: "Add logging to cronjob", id: "9", column: "doing" },

//   { title: "Set up dashboards", id: "10", column: "done" },
// ];

// <section className="grid md:grid-cols-[1fr_200px] 2xl:grid-cols-[1fr_400px]">

//   {/* SECTION */}
//   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
//     <div className="w-full bg-amber-300">1</div>
//     <div className="w-full bg-blue-600">1</div>
//     <div className="w-full bg-gray-800">1</div>
//     <div className="w-full bg-emerald-600">1</div>
//   </div>

//   {/* DROP */}
//   <div className="w-full bg-accent-foreground hidden md:block">1</div>
// </section>
