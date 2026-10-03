import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
// Additive setup for existing installations whose earlier tables were applied manually.
// Fresh installations can use the standard Drizzle migration journal instead.
const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(new URL("../lib/db/0020_momentum.sql", import.meta.url), "utf8");
const [create, constraint] = migration.split("--> statement-breakpoint");
await sql.query(create.replace('CREATE TABLE "momentum_state"', 'CREATE TABLE IF NOT EXISTS "momentum_state"'));
const existing = await sql.query("SELECT 1 FROM pg_constraint WHERE conname = 'momentum_state_user_id_user_id_fk' AND conrelid = 'momentum_state'::regclass");
if (!existing.length) await sql.query(constraint);
console.log("Momentum account table and cascading ownership constraint are ready.");
