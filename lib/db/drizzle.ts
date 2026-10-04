import { databaseSql } from "./http-sql";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const db = drizzle({ client: databaseSql, schema });

export default db;
