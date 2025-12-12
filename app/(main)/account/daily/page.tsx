"use client";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  pointerWithin,
} from "@dnd-kit/core";
import { useState } from "react";

export default function Page() {
  const [isDropped, setIsDropped] = useState(false);

  function handleDragEnd(event: DragEndEvent) {
    if (event.over && event.over.id === "droppable") {
      setIsDropped(true);
    } else {
      setIsDropped(false);
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div
        className="flex flex-col items-center gap-8 
      md:flex-row md:items-start"
      >
        {!isDropped && <Draggable />}

        <Droppoble>{isDropped && <Draggable />}</Droppoble>
      </div>
    </DndContext>
  );
}

function Draggable() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "draggable",
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, 
        ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      style={style}
      className="h-24 w-24 rounded-md 
      bg-blue-500 text-white
      cursor-grab touch-none active:cursor-grabbing
      "
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      Drag me
    </div>
  );
}

function Droppoble({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "droppable" });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-40 w-40 items-center 
        justify-center rounded-md border-2 border-dashed 
        border-gray-400
        ${isOver ? "border-blue-500 bg-blue-900" : "border-gray-400"}
        `}
    >
      {children || <span>DropHere</span>}
    </div>
  );
}
