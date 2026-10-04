import { loadedEnvFiles } from "./legal-environment";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { operatorConfiguration } from "../lib/legal/operator";
import { publicDocuments } from "../lib/legal/public-content";

const args = process.argv.slice(2);
const tables = ["b1_legal_documents", "b1_legal_active", "b1_legal_signup_choices", "b1_legal_signup_reservations", "b1_legal_acceptances", "b1_legal_purchases"];
async function main() {
  const configuration = operatorConfiguration(process.env);
  const documents = publicDocuments(process.env);
  console.log(JSON.stringify({ loadedFiles: loadedEnvFiles.map(file => file.path),
    fields: Object.values(configuration.facts).map(({ variable, status }) => ({ variable, status })),
    optionalRegistration: configuration.registration, optionalTax: configuration.tax,
    publicPagesConfigured: !!documents, source: "Local website copy and allowlisted server environment fields; no policy registry",
    registrationAgreement: "Required at request and account creation; no legal acceptance records stored",
    purchaseReadiness: "Unchanged; separate billing prerequisites" }, null, 2));
  if (args[0] !== "status" && args[0] !== "retire-empty-registry") throw Error("Commands: status [--registry], retire-empty-registry --apply. Database publication commands have been retired.");
  if (args.includes("--registry") || args[0] === "retire-empty-registry") {
    if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required for registry inspection/retirement");
    const sql = neon(process.env.DATABASE_URL);
    const counts = [];
    for (const table of tables) {
      const exists = await sql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`;
      const rows = exists[0]?.present ? await sql.query(`SELECT count(*)::integer AS count FROM public.${table}`) : [];
      counts.push({ table, present: !!exists[0]?.present, records: rows[0]?.count ?? 0 });
    }
    console.log(JSON.stringify({ registry: counts }, null, 2));
    if (args[0] === "retire-empty-registry") {
      if (!args.includes("--apply")) throw Error("Use --apply to retire the empty legal registry. The atomic migration also checks every table under locks.");
      if (counts.some(row => row.records !== 0)) throw Error("Retirement refused: existing legal records must be preserved.");
      await sql.query(await readFile("lib/db/0027_static_legal_pages.sql", "utf8"));
      console.log("Empty legal registry and its signup trigger retired. No user, credential, session, email-proof, membership or module records were removed.");
    }
  }
}
void main().catch(() => { console.error("Legal configuration operation failed. Inspect required configuration or existing registry records privately; no diagnostics or environment values are exposed."); process.exitCode = 1; });
