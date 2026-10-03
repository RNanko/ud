import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
// The transactional adapter keeps Better Auth's user + credential writes atomic.
neonConfig.webSocketConstructor=globalThis.WebSocket;
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
export const authDb=drizzle(pool,{schema});
