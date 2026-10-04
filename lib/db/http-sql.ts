import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
let client: Sql | undefined;

function getClient(): Sql {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured on the server.");
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.hostname || url.pathname.length < 2) {
      throw new Error("Invalid database URL");
    }
    client = neon(connectionString);
  } catch {
    // Neon can include the complete connection string in constructor errors.
    // Report the configuration problem without exposing database credentials.
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  return client;
}

function invoke(method: "query" | "unsafe" | "transaction", args: unknown[]) {
  const sql = getClient();
  return Reflect.apply(sql[method], sql, args);
}

// Next.js imports server modules while collecting routes. Initialize Neon only
// when SQL is used, preserving its query promises for batched transactions.
export const databaseSql = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) => getClient()(strings, ...values),
  {
    query: (...args: unknown[]) => invoke("query", args),
    unsafe: (...args: unknown[]) => invoke("unsafe", args),
    transaction: (...args: unknown[]) => invoke("transaction", args),
  },
) as Sql;
