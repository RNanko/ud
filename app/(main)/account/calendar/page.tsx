"use client";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
  DragCancelEvent,
  useDroppable,
  DragOverEvent,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash, Trash2, Trash2Icon } from "lucide-react";

import { Dispatch, SetStateAction, useState } from "react";

interface Item {
  id: string;
  content: string;
}

interface Container {
  id: string;
  title: string;
  items: Item[];
}

function ItemOverlay({ children }: { children: React.ReactNode }) {
  return (
    // FIXME
    <div className="cursor-grab bg-red-400 rounded border p-3 shadow-md touch-none">
      <div className="flex items-center gap-3 wrap-anywhere">
        <span className="text-gray-500">:</span>
        <span>{children}</span>
      </div>
    </div>
  );
}

export default function MultipleContainers() {
  const [containers, setContainers] = useState<Container[]>([
    {
      id: "backlog",
      title: "Backlog",
      items: [
        { id: "task-11", content: "Look into render bug in dashboard" },
        { id: "task-22", content: "SOX compliance checklist" },
        { id: "task-33", content: "[SPIKE] Migrate to Azure" },
      ],
    },
    {
      id: "todo",
      title: "To Do",
      items: [
        { id: "task-1", content: "Research @dnd-kit" },
        { id: "task-2", content: "Create basic example" },
        { id: "task-3", content: "Write tutorial" },
      ],
    },
    {
      id: "in-progress",
      title: "In Progress",
      items: [{ id: "task-4", content: "Record demo video" }],
    },
    {
      id: "done",
      title: "Done",
      items: [{ id: "task-5", content: "Setup project" }],
    },
  ]);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  void activeId;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // movement required before activatio
        delay: 50, // small delay
        tolerance: 5, // small movements before activating drag
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function findContainerId(itemId: UniqueIdentifier): string | undefined {
    // If ID matches a container ID
    const direct = containers.find((c) => c.id === itemId);
    if (direct) return direct.id;

    // Otherwise search items inside containers
    for (const container of containers) {
      if (container.items.some((item) => item.id === itemId)) {
        return container.id;
      }
    }

    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over) return;

    // 🟢 ALLOW trash to receive hover
    if (over.id === "trash") return;

    const activeId = active.id;
    const overId = over.id;

    const activeContainerId = findContainerId(activeId);
    const overContainerId = findContainerId(overId);

    if (!activeContainerId || !overContainerId) return;
    // 🛠 FIX: don't run cross-container logic inside same container
    if (activeContainerId === overContainerId) return;

    console.log(activeId, overId);
    if (activeId === overId) return;

    setContainers((prev) => {
      const activeContainer = prev.find((c) => c.id === activeContainerId);
      if (!activeContainer) return prev;

      const activeItem = activeContainer.items.find(
        (item) => item.id === activeId
      );
      if (!activeItem) return prev;

      const newContainers = prev.map((container) => {
        if (container.id === activeContainerId) {
          return {
            ...container,
            items: container.items.filter((item) => item.id !== activeId),
          };
        }

        if (container.id === overContainerId) {
          if (overId === overContainerId) {
            return {
              ...container,
              items: [...container.items, activeItem],
            };
          }

          const overIndex = container.items.findIndex(
            (item) => item.id === overId
          );

          if (overIndex !== -1) {
            return {
              ...container,
              items: [
                ...container.items.slice(0, overIndex + 1),
                activeItem,
                ...container.items.slice(overIndex + 1),
              ],
            };
          }
        }

        return container;
      });

      return newContainers;
    });
  }

  function handleDragCancel(event: DragCancelEvent) {
    void event;
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // 🗑️ DELETE FIRST
    if (over.id === "trash") {
      console.log("🗑️ Deleted item id:", active.id);
      setContainers((prev) =>
        prev.map((container) => ({
          ...container,
          items: container.items.filter((item) => item.id !== active.id),
        }))
      );
      setActiveId(null);
      return;
    }

    const activeContainerId = findContainerId(active.id);
    const overContainerId = findContainerId(over.id);

    // 🟢 LOG item and container
    console.log("Dropped item:", active.id);
    console.log("Dropped into container:", overContainerId);

    if (!activeContainerId || !overContainerId) {
      setActiveId(null);
      return;
    }

    if (activeContainerId === overContainerId && active.id !== over.id) {
      const containerIndex = containers.findIndex(
        (c) => c.id === activeContainerId
      );

      if (containerIndex === -1) {
        setActiveId(null);
        return;
      }

      const container = containers[containerIndex];
      const activeIndex = container.items.findIndex(
        (item) => item.id === active.id
      );

      const overIndex = container.items.findIndex(
        (item) => item.id === over.id
      );

      if (activeIndex !== -1 && overIndex !== -1) {
        const newItems = arrayMove(container.items, activeIndex, overIndex);

        setContainers((containers) => {
          return containers.map((c, i) => {
            if (i === containerIndex) {
              return { ...c, items: newItems };
            }
            return c;
          });
        });
      }
    }

    setActiveId(null);
  }

  const getActiveItem = () => {
    for (const container of containers) {
      const item = container.items.find((item) => item.id === activeId);
      if (item) return item;
    }
    return null;
  };

  return (
    <>
      <div className="grid md:grid-cols-[1fr_200px] 2xl:grid-cols-[1fr_400px] gap-4">
        {/* <h2 className="mb-4 text-xl font-bold dark:text-white">Kanban Board</h2> */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragCancel={handleDragCancel}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {containers.map((container) => (
              <DroppobleContainer
                key={container.id}
                id={container.id}
                title={container.title}
                items={container.items}
                setContainers={setContainers}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              // render
              <ItemOverlay>{getActiveItem()?.content}</ItemOverlay>
            ) : null}
          </DragOverlay>
          <TrashDropZone />
        </DndContext>
      </div>
    </>
  );
}

function SortableItem({ id, content }: { id: string; content: string }) {
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
  //FIXME
  const styleDragging = isDragging ? "bg-green-500" : "";

  return (
    <>
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`rounded touch-none border bg-gray-500 p-3  dark:border-gray-800 ${styleDragging} touch-action-none`}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400">⋮</span>
          <span className="dark:text-gray-200 wrap-anywhere">{content}</span>
          {/* FIXME */}
          {/* <Button
            className="block sm:hidden  rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              console.log("click");
            }}
          >
            <X />
          </Button> */}
        </div>
      </li>
    </>
  );
}

function DroppobleContainer({
  id,
  title,
  items,
  setContainers,
}: {
  id: string;
  title: string;
  items: Item[];
  setContainers: Dispatch<SetStateAction<Container[]>>;
}) {
  const { setNodeRef } = useDroppable({ id });

  const [input, setInput] = useState(false);
  const [value, setValue] = useState("");

  function handleAddTask() {
    if (!value.trim()) return;

    setContainers((prev) =>
      prev.map((container) =>
        container.id === id
          ? {
              ...container,
              items: [
                ...container.items,
                {
                  id: crypto.randomUUID(),
                  content: value,
                },
              ],
            }
          : container
      )
    );

    setValue("");
    setInput(false);
  }

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-h-40 flex-col rounded-md border bg-gray-50 p-3 dark:bg-gray-800/50"
    >
      <h3 className="mb-2 font-medium">{title}</h3>

      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} content={item.content} />
          ))}
        </ul>
      </SortableContext>

      <div className="mt-4 flex justify-center">
        {!input ? (
          <Button
            onClick={() => setInput(true)}
            className="flex items-center gap-2 border-2"
          >
            <Plus />
            Add task
          </Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask();
            }}
            className="w-full"
          >
            <Textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter task..."
              className="w-full rounded border p-2 text-black"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setValue("");
                  setInput(false);
                }
              }}
              onBlur={() => {
                if (!value.trim()) setInput(false);
              }}
            />
            <Button type="submit">+</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash",
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-center w-full hidden md:block rounded-md border-2 
        transition-colors ${
          isOver ? "border-red-500 bg-red-600 text-white" : ""
        }`}
    >
      {isOver ? (
        <div className="animate-bounce transition-colors">
          <Trash2 />
        </div>
      ) : (
        <p className="text-2xl">Drop here to delete</p>
      )}
    </div>
  );
}
