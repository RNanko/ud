import type { Journey } from "./types";
export const thoughts = [
  ["Make the next step small enough to begin.", "Choose the first ten minutes of a task you have been avoiding.", "Choose a task"],
  ["Return to the next step, not to the beginning.", "Resume one paused task without restarting the whole plan.", "Choose a task"],
  ["Give today one clear priority.", "Choose one existing task as your main mission.", "Choose a priority"],
  ["Leave yourself a clear place to start tomorrow.", "Write the next action before ending your work session.", "Create a next step"],
  ["Make something with what you are learning.", "Choose one idea to practice or use in a small project.", "Create a practice task"],
  ["A useful first draft gives you something to improve.", "Work on a rough version of one selected deliverable.", "Choose a task"],
  ["Adjust the plan to the day you actually have.", "Shorten or reschedule one commitment deliberately.", "Make today easier"],
  ["Notice what helped, not only what is unfinished.", "Save one useful observation in your weekly review.", "Open weekly review"],
  ["Your next conversation can begin with one thoughtful message.", "Create a task to contact someone you choose. You send it yourself.", "Create a contact task"],
  ["Give your money a purpose you chose.", "Review a personal money goal without being prompted to buy or trade anything.", "Review a money goal"],
  ["Keep the lesson; change the approach.", "Note one obstacle and choose a different next step.", "Open weekly review"],
  ["Rest can be a deliberate part of your plan.", "Review your schedule and choose whether today needs an adjustment.", "Review today"]
] as const;
export const journeyTemplates: { key: string; title: string; area: Journey["area"]; kind: Journey["kind"]; chapters: string[]; outcome: string }[] = [
  { key: "routine", title: "Rebuild my routine", area: "Body", kind: "recurring", outcome: "A manageable training routine I can review.", chapters: ["Choose an existing suitable Gym plan", "Schedule a manageable week", "Follow the chosen plan", "Review and adjust"] },
  { key: "skill", title: "Learn a practical skill", area: "Learning", kind: "learning", outcome: "Make something using a skill I choose.", chapters: ["Choose something to make", "Complete a small practice exercise", "Create something independently", "Seek feedback and improve it"] },
  { key: "project", title: "Finish a project", area: "Work", kind: "project", outcome: "Deliver a finished project with clear criteria.", chapters: ["Define what finished means", "Prepare a first version", "Review it", "Complete the final deliverable"] },
  { key: "reading", title: "Return to reading", area: "Learning", kind: "learning", outcome: "Read a book I choose and try a relevant idea.", chapters: ["Choose a book (accessed elsewhere)", "Complete a reading session", "Record an optional takeaway", "Try one relevant idea"] },
  { key: "experiences", title: "Make room for experiences", area: "Life", kind: "project", outcome: "Enjoy a personally worthwhile activity.", chapters: ["Choose a personally worthwhile activity", "Schedule it", "Confirm attendance", "Optionally reflect or follow up"] },
  { key: "money", title: "Get clear on my money", area: "Money", kind: "money", outcome: "Choose my own next step with the information available.", chapters: ["Choose a review period", "Record or review available information", "Choose a personal next step", "Review later"] }
];
export function journeyDraft(key: string | null, idFor: () => string): Journey {
  const template = journeyTemplates.find(item => item.key === key);
  return { id: idFor(), title: template?.title ?? "", area: template?.area ?? "Work", kind: template?.kind ?? "project", reason: "", outcome: template?.outcome ?? "", nextAction: "", targetDate: null, target: "", status: "active", priority: "primary", template: template ? { key: template.key, version: 1 } : null, chapters: (template?.chapters ?? ["My first step"]).map(title => ({ id: idFor(), title, criterion: `Confirm: ${title.toLowerCase()}`, links: [], confirmedAt: null })) };
}
