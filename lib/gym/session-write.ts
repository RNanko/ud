import { sessionSchema } from './validation';
import type { SessionData } from './types';

/** Shared by web and native writes: submitted targets never rewrite history. */
export function prepareSessionSave(previous: SessionData, input: unknown, now = new Date().toISOString()): SessionData {
  const draft = sessionSchema.parse(input);
  if (previous.status === 'completed' && draft.status !== 'completed') throw new Error('Completed workouts stay completed when edited');
  return sessionSchema.parse({ ...draft, originalPlan: previous.originalPlan, logged: previous.logged,
    startedAt: previous.startedAt,
    finishedAt: draft.status === 'completed' ? previous.finishedAt || now : null,
    exercises: draft.exercises.map(exercise => ({ ...exercise,
      definition: previous.exercises.find(item => item.id === exercise.id)?.definition || exercise.definition,
      planned: previous.originalPlan?.exercises.find(item => item.id === exercise.id)?.targets || null,
    })),
  });
}
