"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { Textarea } from "@/components/ui/textarea";
import { updateToDoList } from "@/lib/actions/todo.actions";
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
import { Plus, Trash2 } from "lucide-react";

import { Dispatch, SetStateAction, useEffect, useState } from "react";

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
    // ELEMENT
    <div className="cursor-grab bg-black rounded border p-3 shadow-md touch-none">
      <div className="flex items-center gap-3 wrap-anywhere">
        <span className="text-gray-500">:</span>
        <span>{children}</span>
      </div>
    </div>
  );
}

export default function KanbanBoard({ data }: { data: Container[] }) {
  const [containers, setContainers] = useState<Container[]>([...data]);

  useEffect(() => {
    console.log("conteiners changed");
    console.log(containers);
    const sync = async () => {
      await updateToDoList(containers);
    };

    sync();
  }, [containers]);

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

    if (over.id === "trash") return;

    const activeId = active.id;
    const overId = over.id;

    const activeContainerId = findContainerId(activeId);
    const overContainerId = findContainerId(overId);

    if (!activeContainerId || !overContainerId) return;
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
      <div className="grid grid-cols-[1fr_50px]  md:grid-cols-[1fr_200px] 2xl:grid-cols-[1fr_300px] gap-4">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragCancel={handleDragCancel}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
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
  //ELEMENT
  const styleDragging = isDragging ? "bg-ring" : "";

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
                  id: crypto.randomUUID().slice(0, 8),
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

  let titleStyle = "";

  switch (title) {
    case "To Do":
      titleStyle = "text-blue-400";
      break;
    case "In Progress":
      titleStyle = "text-yellow-400";
      break;
    case "Done":
      titleStyle = "text-green-400";
      break;
    default:
      titleStyle = "";
  }

  return (
    <Card
      ref={setNodeRef}
      className="flex h-full min-h-40 flex-col rounded-md border p-3"
    >
      <h3 className={`mb-2 font-medium ${titleStyle}`}>{title}</h3>

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

      <div className="flex justify-center">
        {!input ? (
          <Button
            onClick={() => setInput(true)}
            className="flex items-center gap-2 border-2 mb-2"
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
            className="w-full flex flex-col items-center"
          >
            <Textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter task..."
              className="w-full rounded border p-2"
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
            <Button variant={"secondary"} className="w-1/3 mt-2" type="submit">
              +
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash",
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-center w-full hidden md:block rounded-md border-2 min-h-30
        transition-colors ${
          isOver ? "border-red-500 bg-red-600 text-white" : ""
        }`}
    >
      {isOver ? (
        <div className="animate-bounce transition-colors">
          <Trash2 />
        </div>
      ) : (
        <div>
          <p className="hidden md:block text-2xl font-bold text-center">
            Delete
          </p>
          <span className="block md:hidden">
            <Trash2 />
          </span>
        </div>
      )}
    </div>
  );
}
