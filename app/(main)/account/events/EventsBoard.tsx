"use client";
import { cn } from "@/lib/utils";
import { DefaultWeek, EventItems, EventItem } from "@/types/types";
import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
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
import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { updateEventsList } from "@/lib/actions/events.actions";
import { toast } from "sonner";

const todayIndex = (new Date().getDay() + 6) % 7;

export default function EventsBoard({
  containers,
  defaultWeek,
  week,
  setContainers,
}: {
  containers: EventItems[];
  defaultWeek: DefaultWeek[];
  week: string;
  setContainers: Dispatch<SetStateAction<EventItems[]>>;
}) {
  useEffect(() => {
    const sync = async () => {
      await updateEventsList(containers, week);
    };

    sync();
  }, [containers, week]);

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

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || over.id === "trash") return;

      const activeId = active.id;
      const overId = over.id;

      setContainers((prev) => {
        const findContainerId = (itemId: UniqueIdentifier) => {
          const direct = prev.find((c) => c.id === itemId);
          if (direct) return direct.id;

          for (const container of prev) {
            if (container.tasks.some((item) => item.id === itemId)) {
              return container.id;
            }
          }
          return undefined;
        };

        const activeContainerId = findContainerId(activeId);
        let overContainerId = findContainerId(overId);

        if (!activeContainerId || activeId === overId) return prev;

        const activeContainer = prev.find((c) => c.id === activeContainerId);
        if (!activeContainer) return prev;

        const activeItem = activeContainer.tasks.find(
          (item) => item.id === activeId,
        );
        if (!activeItem) return prev;

        // Create target container if missing
        if (!overContainerId) {
          overContainerId = String(overId);
          prev = [
            ...prev,
            { id: overContainerId, day: String(overId), tasks: [] },
          ];
        }

        if (activeContainerId === overContainerId) return prev;

        return prev.map((container) => {
          if (container.id === activeContainerId) {
            return {
              ...container,
              tasks: container.tasks.filter((t) => t.id !== activeId),
            };
          }

          if (container.id === overContainerId) {
            return {
              ...container,
              tasks: [...container.tasks, activeItem],
            };
          }

          return container;
        });
      });
    },

    [setContainers],
  );

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
        {defaultWeek.map((day, i) => {
          const dayData = containers.find((d) => d.day === day.day);

          return (
            <DroppobleContainer
              dayIndex={i}
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
      </DndContext>
    </div>
  );
}

const SortableItem = memo(function SortableItem({
  id,
  title,
  completed,
  setContainers,
}: {
  id: string;
  title: string;
  completed: boolean;
  setContainers: Dispatch<SetStateAction<EventItems[]>>;
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
  //ELEMENT
  const styleDragging = isDragging ? "bg-ring" : "";

  function setChecked(checked: boolean) {
    setContainers((prev) =>
      prev.map((container) => ({
        ...container,
        tasks: container.tasks.map((task) =>
          task.id === id ? { ...task, completed: checked } : task,
        ),
      })),
    );

    toast.success("Mission completed", {
      className: "w-fit max-w-[200px] px-4 py-2 text-sm",
    });
  }
  function deleteTask(taskId: string) {
    setContainers((prev) =>
      prev.map((container) => ({
        ...container,
        tasks: container.tasks.filter((task) => task.id !== taskId),
      })),
    );
    toast.error('Task deleted')
  }

  return (
    <motion.li
      ref={setNodeRef}
      style={style} // keep dnd-kit transform
      transition={{
        duration: 0.25,
        ease: "easeInOut",
      }}
      className={`flex flex-row items-center gap-3
    overflow-hidden
    rounded touch-none border p-3 dark:border-gray-200 ${styleDragging}`}
    >
      <Checkbox checked={completed} onCheckedChange={setChecked} />
      <div
        {...listeners}
        {...attributes}
        className="flex items-center cursor-grab "
      >
        <p
          className={cn(
            "px-5 py-2 rounded-2xl bg-muted-foreground/20 dark:text-gray-100 wrap-anywhere transition-all duration-200",
            completed && "line-through opacity-50",
          )}
        >
          {title}
        </p>
      </div>

      <Button
        className="ml-auto cursor-pointer border-2"
        onClick={(e) => {
          e.stopPropagation();
          deleteTask(id);
        }}
        variant={"outline"}
      >
        Delete
      </Button>
    </motion.li>
  );
});

const DroppobleContainer = memo(function DroppobleContainer({
  id,
  dayIndex,
  weekDay,
  tasks,
  setContainers,
}: {
  id: string;
  dayIndex: number;
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
        completed: false,
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
      className={cn(
        "flex h-full min-h-40 flex-col rounded-md border p-3",
        "transition-all duration-300 ease-in-out",
      )}
    >
      {/* Header */}
      <div
        className="bg-muted-foreground/20 min-w-[200px] xl:w-full rounded-2xl
            flex items-center justify-center p-4"
      >
        <div
          className={cn(
            "font-bold transition-all",
            dayIndex === todayIndex && "border-b-5 border-accent-foreground",
          )}
        >
          <h3
            className={cn(
              "font-bold transition-all p-1",
              !weekDay.workday ? "text-primary" : "text-foreground",
            )}
          >
            {weekDay.day}
          </h3>
        </div>
      </div>

      <SortableContext
        items={tasks.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <motion.ul
          layout
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.06,
                delayChildren: 0.05,
              },
            },
          }}
        >
          {tasks.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              title={item.title}
              completed={item.completed}
              setContainers={setContainers}
            />
          ))}
        </motion.ul>
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
            <Button className="w-1/3 mt-2" type="submit">
              +
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
});

function ItemOverlay({ children }: { children: React.ReactNode }) {
  return (
    // ELEMENT
    <div className="cursor-grab bg-black rounded border p-3 shadow-md">
      <div className="flex items-center gap-3 wrap-anywhere">
        <span className="text-gray-500">:</span>
        <span>{children}</span>
      </div>
    </div>
  );
}
