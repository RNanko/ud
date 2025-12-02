import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./lib/db/", // ./src/db/migartion
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  schemaFilter: "public",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    schema: "public", // 👈 FORCE drizzle to use public schema
  },
});

// https://orm.drizzle.team/docs/get-started/neon-new
