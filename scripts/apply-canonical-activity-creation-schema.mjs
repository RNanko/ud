import { applyScheduleMigration } from './apply-event-schedule-slots-schema.mjs';
export async function applyCanonicalActivityCreationSchema(db, options = {}) {
  if (!(await db.query("SELECT to_regclass('public.b1_scheduled_workouts') AS table")).rows[0].table) throw Error('Apply migration 0043 first.');
  return applyScheduleMigration(db, options, '0050_canonical_activity_creation.sql', "to_regprocedure('public.b1_create_event_activity(text,uuid,text,text,text,jsonb)')");
}
