import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { draftDocuments } from "../lib/legal/drafts";

// Deliberately one existing account. No password reads, reset, fake OTP,
// published policy or checkout bypass. Existing records remain owned by it.
async function main() {
  if (!process.argv.includes("--apply-development-setup")) throw new Error("Explicit --apply-development-setup is required");
  const origin = new URL(process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").origin;
  if (origin !== "http://localhost:3000" || process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("Test setup is allowed only for the localhost development app");
  }
  const sql = neon(process.env.DATABASE_URL!);
  const owners = await sql`SELECT id,email,email_verified FROM public."user" WHERE email='test@test.com'`;
  if (owners.length !== 1) throw new Error("Expected one existing test@test.com account; no account will be created");
  const owner = owners[0].id as string;
  const documents = JSON.stringify({ status: "unapproved-development-draft", bindingAcceptance: false, ...draftDocuments() });
  const id = `local-test/${owner}/${createHash("sha256").update(documents).digest("hex").slice(0,20)}`;
  const migration = await readFile(new URL("../lib/db/0023_development_account_setup.sql", import.meta.url), "utf8");
  await sql.transaction([
    sql.query(migration),
    sql`INSERT INTO public.b1_development_account_setup
      (id,user_id,origin,environment,email_verification_overridden,terms_acknowledged,privacy_acknowledged,draft_documents,requested_by)
      SELECT ${id},id,${origin},'local-development',true,true,true,${documents}::jsonb,'Explicit operator request: enable test login and acknowledge development drafts'
      FROM public."user" WHERE id=${owner} AND email='test@test.com'
      ON CONFLICT(id) DO NOTHING`,
    sql`UPDATE public."user" SET email_verified=true,updated_at=now() WHERE id=${owner} AND email='test@test.com' AND email_verified=false`,
  ]);
  const state = await sql`SELECT u.email,u.email_verified,s.environment,s.terms_acknowledged,s.privacy_acknowledged
    FROM public."user" u JOIN public.b1_development_account_setup s ON s.user_id=u.id
    WHERE u.id=${owner} AND s.id=${id}`;
  if (state.length !== 1 || !state[0].email_verified) throw new Error("Setup could not be confirmed");
  console.log(JSON.stringify({ ...state[0], realLegalAcceptanceCreated: false, passwordsChanged: false, policiesPublished: false }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Test setup failed"); process.exitCode = 1; });
