/** Shared task text presentation; draggable ownership stays with its caller. */
export default function TaskBody({content}:{content:string}) {return <div className="todo-task-body flex items-center gap-3 cursor-grab"><span className="wrap-anywhere text-lg">{content}</span></div>;}
