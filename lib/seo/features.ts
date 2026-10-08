import type { PublicPath } from "./public-pages";
export type FeatureArticle = {
  path: PublicPath; label: string; title: string; description: string; heading: string; intro: string;
  module: "gym" | "events" | "momentum"; steps: { title: string; body: string }[];
  exampleTitle: string; example: string; limits: string[]; questionIds: string[]; related: PublicPath;
};

export const featureArticles: Record<"workout-planner" | "weekly-planner" | "goal-tracker", FeatureArticle> = {
  "workout-planner": {
    path: "/features/workout-planner", label: "Workout planner & training log",
    title: "Workout Planner & Training Log — ManForth | B1-Way",
    description: "Build reusable workouts, plan training in your week, and record actual strength sets and cardio in ManForth. Keep your targets and completed results separate.",
    heading: "Plan workouts. Record what actually happened.",
    intro: "A planned routine is a starting point. Your training log should keep the work you actually did, even when sets, loads or exercises change. ManForth connects a reusable workout, its place in your week and its actual results.",
    module: "gym",
    steps: [
      { title: "Build your own routine", body: "Find exercises by body part and equipment. Name the workout, reorder exercises and enter your own optional targets. Save a reusable template, schedule it or start now." },
      { title: "Make room in your week", body: "Schedule one or more workouts on a date in Gym or plan a linked workout in Events. A clock time is optional. Editing a template later preserves existing snapshots and history." },
      { title: "Log the actual session", body: "Record each strength set separately, or cardio duration with distance when known. Bodyweight and timed exercises use their own fields. Add or skip exercises, save partial progress, or log a past workout directly." },
      { title: "Review the same activity", body: "Open your completed results in Gym. A confirmed workout and its linked Events occurrence can count once toward your selected Momentum training goal." },
    ],
    exampleTitle: "A plan and a result can differ",
    example: "In this illustration, a user plans bench press for 3 sets of 10 at 60 kg. They record 60 kg × 10, 60 kg × 9 and 55 kg × 10. Both the original target and actual sets remain readable. Cycling can instead be recorded as 25 minutes with 8.4 km when the distance is known.",
    limits: ["These are illustrative user-entered values, not weight or repetition recommendations. You choose your own exercises, weights and repetitions.", "Completion can be confirmed without set details; it does not invent loads, repetitions or distance. Only recorded results belong in performance comparisons.", "The app does not diagnose injuries, measure recovery or prescribe progression. Ask a qualified trainer about technique and suitability, and a relevant professional about health conditions."],
    questionIds: ["training-adviser", "workout-goal", "currencies-and-units"], related: "/features/weekly-planner",
  },
  "weekly-planner": {
    path: "/features/weekly-planner", label: "Weekly tasks & events",
    title: "Weekly Planner for Tasks & Events — ManForth | B1-Way",
    description: "Organize weekly events with optional times, reuse plans and keep tasks moving. Connect scheduled workouts to their actual Gym results in ManForth.",
    heading: "Give your week a workable plan.",
    intro: "Some commitments need a time. Others only need a place in the week. Use Events for dated plans, To-Do for tasks moving through your board, and Gym for the training you actually complete.",
    module: "events",
    steps: [
      { title: "Choose a week and a day", body: "Move between weeks or return to the current week. Plan a dated event with an optional time, add more than one activity to a day and keep the selected-day view readable on a phone." },
      { title: "Reuse the parts that repeat", body: "Save event presets and up to three week presets in Events. In Gym, copying a planned week copies plans rather than completed sets, actual weights or completion status." },
      { title: "Keep tasks moving", body: "Move whole To-Do cards between To do, In progress and Done. Reorder tasks and use keyboard controls as an alternative to dragging." },
      { title: "Confirm what happened", body: "Complete an event yourself or open its linked workout in Gym. A finished clock time does not confirm an activity. Internal notifications can surface reminders inside your account." },
    ],
    exampleTitle: "A week with room for change",
    example: "Plan a workout for Monday without a time, a meet-up for Friday at 18:30, and a car inspection task on your board. Move the workout when your week changes, record the actual training in Gym, and review the confirmed activity in Momentum.",
    limits: ["Planned events and workouts are not automatically completed when their date or end time passes.", "Internal notifications are inside the app. Outside-app email reminders, push delivery and released native apps are not promised here.", "A reused plan starts with its planned information. Completed training results stay in their original sessions."],
    questionIds: ["about-manforth", "workout-goal", "no-card-trial"], related: "/features/workout-planner",
  },
  "goal-tracker": {
    path: "/features/goal-tracker", label: "Goals & weekly review",
    title: "Goal Tracker & Weekly Review — ManForth | B1-Way",
    description: "Set your own Momentum goal periods, connect recorded workouts and focus time, and reflect with Journeys, Recent Wins and Weekly Review in ManForth.",
    heading: "See what your recorded actions are building.",
    intro: "A goal needs a rule you understand, a period that makes sense and an honest record of action. Momentum brings those records together with Journeys, Recent Wins and a short Weekly Review.",
    module: "momentum",
    steps: [
      { title: "Choose your goal and period", body: "Define the rules you want to follow, such as confirmed training sessions in a week or recorded focus minutes. A target you choose is a planning decision, not an automatic prescription." },
      { title: "Connect recorded actions", body: "A confirmed Gym workout and its linked Events occurrence count once. Focus time comes from recorded Momentum sessions. Planned or unconfirmed work is kept separate from completion." },
      { title: "Keep a Journey", body: "Connect useful actions to the direction you chose. Look back at Recent Wins and write down what made progress easier or harder." },
      { title: "Review and adjust", body: "Use Weekly Review to consider what happened and what to change next week. Progress reflects the chosen goal period and recorded data, rather than a manufactured health or success score." },
    ],
    exampleTitle: "One workout, one contribution to your goal",
    example: "A user chooses three confirmed workouts for their week. Two are already recorded. They complete the third in Gym from its linked Events plan: Momentum shows 3 of 3, not an extra fourth activity. Another goal may show 75 of 100 recorded focus minutes; that measures time logged, not mastery.",
    limits: ["A planned session does not count as completed. Duplicate views of a linked workout do not create extra progress.", "Money goals use the manual Momentum balance and contribution journal. Automatic linking from Finance or Investments is not included. Contributions are recorded money, not investment returns.", "The app does not measure muscle recovery, predict physique or guarantee financial or personal outcomes. Automatic phone step sensing is not part of this web release."],
    questionIds: ["workout-goal", "money-movement", "support-and-data"], related: "/features/weekly-planner",
  },
};
