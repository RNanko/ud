import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { AsyncLocalStorage } from "node:async_hooks";
// The transactional adapter keeps Better Auth's user + credential writes atomic.
neonConfig.webSocketConstructor=globalThis.WebSocket;
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
const database=drizzle(pool,{schema});
type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
const transactions=new AsyncLocalStorage<Transaction>();
// Better Auth retains its adapter. Route every operation (including nested
// adapter transactions/savepoints) through the request's outer transaction.
export const authDb=new Proxy(database,{
 get(target,key){const source=transactions.getStore()??target;const value=Reflect.get(source,key);return typeof value==='function'?value.bind(source):value;},
});
export const currentAuthTransaction=()=>transactions.getStore();
export async function runAuthTransaction<T>(work:()=>Promise<T>):Promise<T>{
 if(transactions.getStore())return work();
 return database.transaction(transaction=>transactions.run(transaction,work));
}
