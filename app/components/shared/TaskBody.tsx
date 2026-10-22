/** Shared task text presentation; draggable ownership stays with its caller. */
export default function TaskBody({content}:{content:string}) {
  return <div className="todo-task-body flex min-w-0 items-center gap-3 cursor-grab">
    <span className="min-w-0 whitespace-pre-wrap wrap-anywhere text-lg" style={{ tabSize: 4 }}>{content}</span>
  </div>;
}
