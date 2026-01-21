"use client";
import { cn } from "@/lib/utils";
import {
  DefaultWeek,
  EventContainer,
  EventItems,
  EventItem,
} from "@/types/types";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EventsBoard({
  data,
  defaultWeek,
}: {
  data: EventContainer;
  defaultWeek: DefaultWeek[];
}) {
  // layout
  const todayIndex = (new Date().getDay() + 6) % 7;

  // drag
  const [containers, setContainers] = useState<EventItems[]>([...data.dayData]);

  // useEffect(() => {
  //   console.log("conteiners changed");
  //   console.log(containers);
  //   const sync = async () => {
  //     // await updateToDoList(containers);
  //   };

  //   sync();
  // }, [containers]);

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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function findContainerId(itemId: UniqueIdentifier): string | undefined {
    // If ID matches a container ID
    const direct = containers.find((c) => c.id === itemId);
    if (direct) return direct.id;

    // Otherwise search items inside containers
    for (const container of containers) {
      if (container.tasks.some((item) => item.id === itemId)) {
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
  if (!over || over.id === "trash") return;

  const activeId = active.id;
  const overId = over.id;

  const activeContainerId = findContainerId(activeId);
  let overContainerId = findContainerId(overId);

  if (!activeContainerId) return;
  if (activeId === overId) return;

  setContainers((prev) => {
    const activeContainer = prev.find((c) => c.id === activeContainerId);
    if (!activeContainer) return prev;

    const activeItem = activeContainer.tasks.find(
      (item) => item.id === activeId,
    );
    if (!activeItem) return prev;

    // 🟢 CREATE TARGET DAY IF MISSING
    if (!overContainerId) {
      overContainerId = String(overId);

      prev = [
        ...prev,
        {
          id: overContainerId,
          day: String(overId),
          tasks: [],
        },
      ];
    }

    if (activeContainerId === overContainerId) return prev;

    return prev.map((container) => {
      // remove from source
      if (container.id === activeContainerId) {
        return {
          ...container,
          tasks: container.tasks.filter((t) => t.id !== activeId),
        };
      }

      // insert into target
      if (container.id === overContainerId) {
        const overIndex = container.tasks.findIndex(
          (t) => t.id === overId,
        );

        if (overIndex === -1) {
          return {
            ...container,
            tasks: [...container.tasks, activeItem],
          };
        }

        return {
          ...container,
          tasks: [
            ...container.tasks.slice(0, overIndex),
            activeItem,
            ...container.tasks.slice(overIndex),
          ],
        };
      }

      return container;
    });
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
          tasks: container.tasks.filter((item) => item.id !== active.id),
        })),
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
        (c) => c.id === activeContainerId,
      );

      if (containerIndex === -1) {
        setActiveId(null);
        return;
      }

      const container = containers[containerIndex];
      const activeIndex = container.tasks.findIndex(
        (item) => item.id === active.id,
      );

      const overIndex = container.tasks.findIndex(
        (item) => item.id === over.id,
      );

      if (activeIndex !== -1 && overIndex !== -1) {
        const newTasks = arrayMove(container.tasks, activeIndex, overIndex);

        setContainers((containers) => {
          return containers.map((c, i) => {
            if (i === containerIndex) {
              return { ...c, tasks: newTasks };
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
      const item = container.tasks.find((item) => item.id === activeId);
      if (item) return item;
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(400px,1fr))] gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragCancel={handleDragCancel}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {defaultWeek.map((day) => {
          const dayData = containers.find((d) => d.day === day.day);

          return (
            <DroppobleContainer
              key={day.day}
              id={dayData?.id ?? day.day} // fallback ID
              weekDay={day}
              tasks={dayData?.tasks ?? []}
              setContainers={setContainers}
            />
          );
        })}
        <DragOverlay>
          {activeId ? (
            // render
            <ItemOverlay>{getActiveItem()?.title}</ItemOverlay>
          ) : null}
        </DragOverlay>
        <TrashDropZone />
      </DndContext>
    </div>
  );
}

function SortableItem({ id, title }: { id: string; title: string }) {
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
          <span className="dark:text-gray-200 wrap-anywhere">{title}</span>
        </div>
      </li>
    </>
  );
}

function DroppobleContainer({
  id,
  weekDay,
  tasks,
  setContainers,
}: {
  id: string;
  weekDay: DefaultWeek;
  tasks: EventItem[];
  setContainers: Dispatch<SetStateAction<EventItems[]>>;
}) {
  const { setNodeRef } = useDroppable({ id });

  const [input, setInput] = useState(false);
  const [value, setValue] = useState("");

  function handleAddTask() {
    if (!value.trim()) return;

    setContainers((prev) => {
      const index = prev.findIndex((c) => c.id === id);

      const newTask = {
        id: crypto.randomUUID(),
        title: value,
      };

      if (index === -1) {
        return [
          ...prev,
          {
            id,
            day: weekDay.day,
            tasks: [newTask],
          },
        ];
      }

      return prev.map((container, i) =>
        i === index
          ? { ...container, tasks: [...container.tasks, newTask] }
          : container,
      );
    });

    setValue("");
    setInput(false);
  }

  return (
    <Card
      ref={setNodeRef}
      className="flex h-full min-h-40 flex-col rounded-md border p-3"
    >
      {/* Header */}
      <div
        className="bg-muted-foreground/20 min-w-[200px] xl:w-full
            flex items-center justify-center p-4"
      >
        <h3
          className={cn(
            "font-bold transition-all",
            !weekDay.workday ? "text-primary" : "text-foreground",
          )}
        >
          {weekDay.day}
        </h3>
      </div>

      <SortableContext
        items={tasks.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {tasks.map((item) => (
            <SortableItem key={item.id} id={item.id} title={item.title} />
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
