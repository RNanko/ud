import type { EventItems } from '@/types/types';
import type { GymData } from '../gym/types';
import type { TodoBoard } from '../todo';
export type ActivitySources = { todo: TodoBoard; gym: GymData; weeks: { week: string; data: EventItems[] }[] };
export type Occurrence = { version?: string; timing?: import('../planner-time').EventTiming; id: string; locator: string; date: string; completedDate: string | null; completedAt: string | null; completed: boolean; title: string; category: string; workout: boolean; seriesId: string | null; routineId: string | null; href: string };
