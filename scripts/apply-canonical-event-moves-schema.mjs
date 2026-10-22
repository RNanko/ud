import { applyScheduleMigration } from './apply-event-schedule-slots-schema.mjs';
export async function applyCanonicalEventMovesSchema(db, options = {}) {
  if (!(await db.query("SELECT to_regclass('public.b1_activity_operations') AS table")).rows[0].table) throw Error('Apply migration 0042 first.');
  return applyScheduleMigration(db, options, '0051_canonical_event_moves.sql', "to_regprocedure('public.b1_move_event_activity(text,uuid,text,text,text,text,jsonb,jsonb)')");
}
