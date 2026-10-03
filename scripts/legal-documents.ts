import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { draftDocuments } from "../lib/legal/drafts";
import { documentSchema, contentHash, assertPublishable, reviewSchema } from "../lib/legal/validation";
import { agreementStatement } from "../lib/legal/types";

const args = process.argv.slice(2), mode = args[0];
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
// Operator CLI; database mutations are never exposed as public server actions.
async function main() {
if (mode === "draft") {
  const output = option("--out") || "legal-review";
  await mkdir(output, { recursive: true });
  for (const [kind, document] of Object.entries(draftDocuments())) await writeFile(`${output}/${kind}.json`, JSON.stringify(document, null, 2), { flag: "wx" });
  console.log(`Development drafts created in ${output}. Edit copies, replace all review markers, choose a new version/ID and effective date. No document was approved/published.`);
} else {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  if (mode === "migrate") {
    if (!args.includes("--apply")) throw Error("Use migrate --apply for the additive legal schema. No existing acceptance is backfilled.");
    const source = await readFile("lib/db/0022_legal_documents.sql", "utf8");
    await sql.transaction(source.split("--> statement-breakpoint").map(value => sql.query(value.trim())).filter(Boolean));
    console.log("Additive legal schema installed. Existing users, content and membership rows unchanged.");
  } else if (mode === "stage") {
    const file = option("--document"); if (!file) throw Error("stage --document <reviewed-content.json>");
    const document = documentSchema.parse(JSON.parse(await readFile(file, "utf8"))), hash = contentHash(document);
    await sql`INSERT INTO b1_legal_documents(id,product,locale,kind,version,content,content_hash) VALUES(${document.id},${document.product},${document.locale},${document.kind},${document.version},${JSON.stringify(document)},${hash}) ON CONFLICT(id) DO NOTHING`;
    const existing = await sql`SELECT content_hash FROM b1_legal_documents WHERE id=${document.id}`;
    if (existing[0]?.content_hash !== hash) throw Error("This version already has different content. Use a new ID/version.");
    console.log(`Staged ${document.id}. Content is immutable; approval is a separate human action.`);
  } else if (mode === "approve") {
    const id = option("--id"), file = option("--review"); if (!id || !file) throw Error("approve --id <id> --review <human-review.json>");
    const review = reviewSchema.parse(JSON.parse(await readFile(file, "utf8")));
    const rows = await sql`SELECT * FROM b1_legal_documents WHERE id=${id} AND status='draft'`;
    if (!rows[0]) throw Error("Select an existing draft");
    const document = documentSchema.parse(rows[0].content); assertPublishable(document);
    if (contentHash(document) !== rows[0].content_hash) throw Error("Content integrity failure");
    await sql`UPDATE b1_legal_documents SET status='approved',review=${JSON.stringify(review)} WHERE id=${id} AND status='draft'`;
    console.log("Recorded the supplied human approval. This command does not perform or certify legal review.");
  } else if (mode === "publish") {
    const terms = option("--terms"), privacy = option("--privacy"); if (!terms || !privacy) throw Error("publish --terms <id> --privacy <id>");
    const rows = await sql`SELECT * FROM b1_legal_documents WHERE id IN(${terms},${privacy}) AND status IN('approved','published')`;
    if (rows.length !== 2) throw Error("Both versions need explicit review approval");
    for (const row of rows) { const doc = documentSchema.parse(row.content); assertPublishable(doc); reviewSchema.parse(row.review); if (contentHash(doc) !== row.content_hash || doc.product !== "b1-way-personal" || doc.locale !== "en" || doc.id !== (doc.kind === "terms" ? terms : privacy) || Date.parse(doc.effectiveDate) > Date.now()) throw Error("Invalid or not-yet-effective publication pair"); }
    const purchaseReady = rows.every(row => row.review.purchaseReady === true);
    const active = await sql`SELECT terms_id,privacy_id FROM b1_legal_active WHERE product='b1-way-personal' AND locale='en'`;
    if (active[0] && (active[0].terms_id !== terms || active[0].privacy_id !== privacy) && rows.some(row => row.review.reacceptance === 'notified-contractual-review')) throw Error('Material policy updates are blocked until the reviewed existing-user notice/reacceptance workflow is implemented. Existing published documents remain active.');
    await sql.transaction([
      sql`UPDATE b1_legal_documents SET status='published',published_at=now() WHERE id IN(${terms},${privacy}) AND status='approved'`,
      sql`INSERT INTO b1_legal_active(product,locale,terms_id,privacy_id,statement_version,statement,purchase_ready) VALUES('b1-way-personal','en',${terms},${privacy},${agreementStatement.version},${agreementStatement.text},${purchaseReady}) ON CONFLICT(product,locale) DO UPDATE SET terms_id=EXCLUDED.terms_id,privacy_id=EXCLUDED.privacy_id,statement_version=EXCLUDED.statement_version,statement=EXCLUDED.statement,purchase_ready=EXCLUDED.purchase_ready,activated_at=now()`,
    ]);
    console.log(`Published immutable versions and switched the active pair atomically. Purchases reviewed: ${purchaseReady}. Communicate any material revision using the separately reviewed notice process; no automatic messages were sent.`);
  } else throw Error("Commands: draft, migrate --apply, stage, approve, publish. See docs/legal-readiness.md.");
}
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Legal document operation failed"); process.exitCode = 1; });
