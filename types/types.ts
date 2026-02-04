export type AccountUser = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  image: string | null;
};
export interface EventItem {
  id: string;
  title: string;
  completed: boolean;
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

export type NewQuote = {
  id: string;
  quote: string;
  author: string;
};
