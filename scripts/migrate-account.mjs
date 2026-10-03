import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomBytes, createCipheriv, createHash } from "node:crypto";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const tables = await sql.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
const names = tables.map(row => row.tablename);
const totals = {};
for (const name of names) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error("Unexpected table identifier");
  totals[name] = Number((await sql.query(`SELECT count(*) AS count FROM "${name}"`))[0].count);
}
const identities = await sql.query(`SELECT count(*) FILTER(WHERE EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL)) AS password_users,
 count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL)) AS migration_required,
 count(*) FILTER(WHERE email_verified=false) AS unverified_users FROM "user" u`);
const report = { at: new Date().toISOString(), product: "b1-way-personal", mode: process.argv.includes("--apply") ? "apply" : "audit", counts: totals, identityAudit: identities[0], financeCurrencyUnassigned: names.includes("finance_table") && !(await sql.query("SELECT 1 FROM information_schema.columns WHERE table_name='finance_table' AND column_name='currency'")).length ? totals.finance_table : Number((await sql.query("SELECT count(*) AS count FROM finance_table WHERE currency IS NULL"))[0].count) };
console.log(JSON.stringify(report, null, 2));
if (!process.argv.includes("--apply")) process.exit(0);

// Capture a consistent read-only snapshot in one transaction before additive DDL.
const reads = names.map(name => sql.query(`SELECT coalesce(jsonb_agg(t),'[]'::jsonb) AS rows FROM "${name}" t`));
const results = await sql.transaction(reads, { isolationLevel: "RepeatableRead", readOnly: true });
const plaintext = Buffer.from(JSON.stringify({ report, tables: Object.fromEntries(names.map((name, index) => [name, results[index][0].rows])) }));
if (plaintext.length > 100 * 1024 * 1024) throw new Error("Use an operator-managed pg_dump backup for this database size");
const root = new URL("../migration-backups/", import.meta.url);
await mkdir(root, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([iv, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
await writeFile(new URL(`${stamp}.key`, root), key, { flag: "wx", mode: 0o600 });
await writeFile(new URL(`${stamp}.backup`, root), encrypted, { flag: "wx", mode: 0o600 });
const source = await readFile(new URL("../lib/db/0021_account_membership.sql", import.meta.url), "utf8");
const statements = source.split(/;\s*(?:\r?\n|$)/).map(value => value.trim()).filter(Boolean);
await sql.transaction(statements.map(statement => sql.query(statement)), { isolationLevel: "Serializable" });
await writeFile(new URL(`${stamp}.report.json`, root), JSON.stringify({ ...report, migrationSha256: createHash("sha256").update(source).digest("hex"), backupBytes: encrypted.length, completed: true }, null, 2));
console.log(`Additive migration completed. Encrypted backup and report: migration-backups/${stamp}.*. Keep the key separately in operator storage. No identities or existing records changed.`);
