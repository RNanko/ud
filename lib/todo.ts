import { z } from "zod";

export interface TodoTask { id: string; content: string; completedAt?: string | null; dueDate?: string | null }
export interface TodoGroup { id: string; title: string; items: TodoTask[] }
export type TodoBoard = TodoGroup[];
export const todoGroups = [
  { id: "backlog", title: "Backlog" }, { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" }, { id: "done", title: "Done" }
];
export const emptyTodoBoard = (): TodoBoard => todoGroups.map(group => ({ ...group, items: [] }));
export const todoBoardSchema = z.array(z.object({
  id: z.string().min(1).max(100), title: z.string().min(1).max(100),
  items: z.array(z.object({ id: z.string().min(1).max(100), content: z.string().min(1).max(10000), completedAt: z.iso.datetime().nullable().optional(), dueDate: z.iso.date().nullable().optional() }).strict()).max(1000)
}).strict()).length(4).superRefine((board, context) => {
  const ids = new Set<string>();
  board.forEach((group, index) => {
    if (group.id !== todoGroups[index].id || group.title !== todoGroups[index].title) context.addIssue({ code: "custom", message: "Keep the existing task groups." });
    group.items.forEach(task => {
      if (ids.has(task.id) || todoGroups.some(group => group.id === task.id) || task.id === "trash") context.addIssue({ code: "custom", message: "Task IDs must be unique." });
      if (!task.content.trim()) context.addIssue({ code: "custom", message: "Enter a task." });
      ids.add(task.id);
    });
  });
});
export function sameTodoBoard(left: TodoBoard, right: TodoBoard) {
  return left.length === right.length && left.every((group, index) => {
    const other = right[index];
    return group.id === other.id && group.title === other.title && group.items.length === other.items.length && group.items.every((task, index) => task.id === other.items[index].id && task.content === other.items[index].content && task.completedAt === other.items[index].completedAt && task.dueDate === other.items[index].dueDate);
  });
}
export function taskGroup(board: TodoBoard, taskId: string) { return board.find(group => group.items.some(task => task.id === taskId)); }
export type TodoDestination = { groupId: string; beforeId: string | null };
// Insert by stable neighbouring ID. Other tasks (including hidden tasks) retain relative order.
export function moveTodoTask(board: TodoBoard, id: string, destination: TodoDestination): TodoBoard {
  const source = taskGroup(board, id), target = board.find(group => group.id === destination.groupId);
  const task = source?.items.find(task => task.id === id);
  if (!source || !target || !task || destination.beforeId === id || destination.beforeId && !target.items.some(task => task.id === destination.beforeId)) return board;
  const next = board.map(group => {
    if (group.id !== source.id && group.id !== target.id) return group;
    const items = group.items.filter(task => task.id !== id);
    if (group.id === target.id) items.splice(destination.beforeId === null ? items.length : items.findIndex(task => task.id === destination.beforeId), 0, source.id === target.id ? task : { ...task, completedAt: target.id === "done" ? task.completedAt ?? new Date().toISOString() : null });
    return { ...group, items };
  });
  return sameTodoBoard(board, next) ? board : next;
}
export function keyboardTodoDestination(board: TodoBoard, id: string, key: string): TodoDestination | null {
  const source = taskGroup(board, id);
  if (!source) return null;
  const index = source.items.findIndex(task => task.id === id);
  if (key === "ArrowUp") return index > 0 ? { groupId: source.id, beforeId: source.items[index - 1].id } : null;
  if (key === "ArrowDown") return index < source.items.length - 1 ? { groupId: source.id, beforeId: source.items[index + 2]?.id ?? null } : null;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const target = board[board.indexOf(source) + (key === "ArrowLeft" ? -1 : 1)];
    return target ? { groupId: target.id, beforeId: target.items[index]?.id ?? null } : null;
  }
  return null;
}

export type TodoSaveResult = { success: boolean; message?: string; conflict?: boolean; data?: TodoBoard };
