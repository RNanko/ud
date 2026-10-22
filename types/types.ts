export type AccountUser = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  image: string | null;
};
export interface EventItem {
  scheduled?: import("@/lib/events/recurrence").ScheduleRef;
  momentumSeriesId?: string;
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string | null;
  notes?: string;
  category?: string;
  icon?: "calendar" | "book" | "work" | "coffee" | "workout";
  tone?: import("@/lib/events").EventTone;
  timing?: import("@/lib/planner-time").EventTiming;
  order?: number;
  kind?: "manual" | "training";
  workout?: import("@/lib/gym/types").Blueprint;
  workoutLink?: { kind: "plan" | "session"; id: string } | null;
}

export interface EventItems {
  id: string;
  day: string;
  tasks: EventItem[];
}
export interface DefaultWeek {
  day: string;
  workday: boolean;
}

export interface EventContainer {
  week: string;
  dayData: EventItems[];
  days?: DefaultWeek[];
}

export interface NoteItem {
  id: string;
  event: string;
  date?: string;
  description?: string;
  createdAt: number;
}
