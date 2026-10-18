/** Only reviewed public explanations belong here. No user IDs, query strings or legal drafts. */
export const publicPages = [
  { path: "/", label: "ManForth" },
  { path: "/help", label: "Help & Q&A" },
  { path: "/features/workout-planner", label: "Gym & activity tracker" },
  { path: "/features/weekly-planner", label: "Calendar & event planner" },
  { path: "/features/goal-tracker", label: "Goals & weekly review" },
  { path: "/features/notes", label: "Notes, checklists & sketches" },
  { path: "/features/money-tracker", label: "Money & expense tracker" },
  { path: "/features/to-do", label: "To-do lists & task board" },
  { path: "/features/investment-tracker", label: "Stock, ETF & crypto tracker" },
] as const;
export type PublicPath = (typeof publicPages)[number]["path"];
export const publicFeaturePages = publicPages.slice(2);

/** Auth pages remain crawlable so their noindex is visible. Privacy is enforced by auth, never robots. */
export const privateCrawlPrefixes = ["/account", "/api"];
export const excludedSearchSurfaces = ["/account/:path*", "/auth/:path*", "/api/:path*", "/terms/:path*", "/privacy/:path*"];
