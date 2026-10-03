import "server-only";
import { accountSql } from "../account/store";
import { PERSONAL_PRODUCT, annualPrices, type BillingCurrency } from "../account/config";
import { draftDocuments, allowDraftPreview } from "./drafts";
import { contentHash, documentSchema, validateAgreement, assertPublishable, reviewSchema } from "./validation";
import type { LegalBundle, LegalDocument, LegalKind } from "./types";

function readDocument(row: Record<string, unknown>): LegalDocument {
  const document = documentSchema.parse(row.content);
  if (contentHash(document) !== row.content_hash) throw Error("Legal content integrity check failed");
  return document;
}
export async function publishedBundle(): Promise<LegalBundle | null> {
  try {
    const rows = await accountSql`SELECT a.*,t.content AS terms_content,t.content_hash AS terms_hash,t.review AS terms_review,p.content AS privacy_content,p.content_hash AS privacy_hash,p.review AS privacy_review
    FROM b1_legal_active a JOIN b1_legal_documents t ON t.id=a.terms_id JOIN b1_legal_documents p ON p.id=a.privacy_id
    WHERE a.product=${PERSONAL_PRODUCT} AND a.locale='en' AND t.status='published' AND p.status='published'
    AND (t.content->>'effectiveDate')::date<=current_date AND (p.content->>'effectiveDate')::date<=current_date`;
    if (!rows[0]) return null;
    const row = rows[0], terms = readDocument({ content: row.terms_content, content_hash: row.terms_hash }), privacy = readDocument({ content: row.privacy_content, content_hash: row.privacy_hash });
    assertPublishable(terms); assertPublishable(privacy); const termsReview=reviewSchema.parse(row.terms_review),privacyReview=reviewSchema.parse(row.privacy_review);
    if (terms.kind !== "terms" || privacy.kind !== "privacy" || terms.product !== PERSONAL_PRODUCT || privacy.product !== PERSONAL_PRODUCT || terms.id !== row.terms_id || privacy.id !== row.privacy_id || terms.locale !== 'en' || privacy.locale !== 'en') return null;
    return { product: PERSONAL_PRODUCT, locale: "en", statementVersion: row.statement_version, statement: row.statement, terms: { id: terms.id, version: terms.version, hash: row.terms_hash, href: `/terms/${terms.version}` }, privacy: { id: privacy.id, version: privacy.version, hash: row.privacy_hash, href: `/privacy/${privacy.version}` }, purchaseReady: !!row.purchase_ready && termsReview.purchaseReady && privacyReview.purchaseReady };
  } catch { return null; } // Fail closed; existing security, billing management and public support stay available.
}
export async function publicDocument(kind: LegalKind, version?: string) {
  const bundle = await publishedBundle();
  const id = version ? `${PERSONAL_PRODUCT}:${kind}:en:${version}` : bundle?.[kind].id;
  try {
    if (id) {
      const rows = await accountSql`SELECT * FROM b1_legal_documents WHERE id=${id} AND product=${PERSONAL_PRODUCT} AND locale='en' AND kind=${kind} AND status='published'`;
      if (rows[0]) {
        const document=readDocument(rows[0]);assertPublishable(document);reviewSchema.parse(rows[0].review);
        const history = await accountSql`SELECT version,content->>'effectiveDate' AS effective_date FROM b1_legal_documents WHERE product=${PERSONAL_PRODUCT} AND locale='en' AND kind=${kind} AND status='published' ORDER BY published_at DESC`;
        return { document, draft: false, history: history.map(row => ({ version: String(row.version), effectiveDate: String(row.effective_date) })) };
      }
    }
  } catch { /* Missing storage never publishes a fallback as approved. */ }
  if (allowDraftPreview() && (!version || version === draftDocuments()[kind].version)) return { document: draftDocuments()[kind], draft: true, history: [] };
  return null;
}
export async function recordSignupAgreement(attempt: Record<string, unknown>, input: unknown) {
  const bundle = await publishedBundle();
  validateAgreement(input, bundle);
  if (!bundle || attempt.purpose !== "signup" || attempt.owner_id || attempt.consumed_at) throw Error("Use your own active registration attempt");
  if (typeof attempt.id !== 'string' || typeof attempt.user_id !== 'string') throw Error('Invalid registration proof');
  const rows = await accountSql`INSERT INTO b1_legal_signup_choices(id,attempt_id,intended_user_id,product,locale,terms_id,privacy_id,statement_version,statement,terms_accepted,privacy_acknowledged)
  SELECT ${crypto.randomUUID()},id,user_id,${PERSONAL_PRODUCT},'en',${bundle.terms.id},${bundle.privacy.id},${bundle.statementVersion},${bundle.statement},true,true
  FROM b1_email_attempts WHERE id=${attempt.id} AND user_id=${attempt.user_id} AND purpose='signup' AND owner_id IS NULL AND consumed_at IS NULL AND expires_at>now()
  ON CONFLICT(attempt_id,terms_id,privacy_id,statement_version) DO UPDATE SET id=b1_legal_signup_choices.id RETURNING id`;
  if (!rows[0]) throw Error("Your registration attempt expired. Request verification again.");
  return String(rows[0].id);
}
export async function reserveSignup(attempt: Record<string, unknown>, choiceId: string) {
  if (typeof attempt.id !== 'string' || typeof attempt.user_id !== 'string') throw Error('Invalid registration proof');
  const rows = await accountSql`INSERT INTO b1_legal_signup_reservations(attempt_id,intended_user_id,choice_id)
  SELECT a.id,a.user_id,c.id FROM b1_email_attempts a JOIN b1_legal_signup_choices c ON c.attempt_id=a.id
  WHERE a.id=${attempt.id} AND a.user_id=${attempt.user_id} AND c.id=${choiceId} AND a.verified_at IS NOT NULL AND a.consumed_at IS NULL AND a.expires_at>now()
  ON CONFLICT(attempt_id) DO UPDATE SET choice_id=EXCLUDED.choice_id WHERE NOT EXISTS(SELECT 1 FROM "user" u WHERE u.id=b1_legal_signup_reservations.intended_user_id) RETURNING attempt_id`;
  if (!rows[0]) throw Error("Registration is already being finalized. Retry or sign in.");
}
/** Called by the supported auth create-before hook; the DB trigger finalizes evidence in the user/credential transaction. */
export async function assertSignupReservation(owner: string, email: string) {
  const rows = await accountSql`SELECT 1 FROM b1_legal_signup_reservations r JOIN b1_email_attempts e ON e.id=r.attempt_id JOIN b1_legal_signup_choices c ON c.id=r.choice_id JOIN b1_legal_active a ON a.product=c.product AND a.locale=c.locale
  WHERE r.intended_user_id=${owner} AND e.user_id=${owner} AND e.email=${email.toLowerCase()} AND e.purpose='signup' AND e.owner_id IS NULL AND e.verified_at IS NOT NULL AND e.consumed_at IS NOT NULL AND e.expires_at>now()
  AND c.product=${PERSONAL_PRODUCT} AND c.locale='en' AND a.terms_id=c.terms_id AND a.privacy_id=c.privacy_id AND a.statement_version=c.statement_version
  AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='b1_finalize_signup_legal' AND tgrelid='public.user'::regclass AND tgenabled IN('O','A'))`;
  if (!rows[0]) throw Error("Eligible agreement evidence is required before creating an account");
}
export async function signupFinalized(owner: string) {
  const rows = await accountSql`SELECT 1 FROM b1_legal_acceptances l JOIN "user" u ON u.id=l.user_id WHERE l.user_id=${owner} AND l.product=${PERSONAL_PRODUCT} AND l.context='registration' AND u.email_verified=true`;
  return !!rows[0];
}
export async function legalAccountHistory(owner: string) {
  const bundle = await publishedBundle();
  try {
    const records = await accountSql`SELECT id,context,locale,terms_id,privacy_id,terms_hash,privacy_hash,statement,terms_accepted_at,privacy_acknowledged_at,associated_at,receipt FROM b1_legal_acceptances WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} ORDER BY terms_accepted_at DESC`;
    const purchases = await accountSql`SELECT operation,currency,amount,price_id,terms_id,privacy_id,presented_at,receipt FROM b1_legal_purchases WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} ORDER BY presented_at DESC`;
    return { bundle, records, purchases, unavailable: false };
  } catch { return { bundle, records: [], purchases: [], unavailable: true }; }
}
export async function purchaseLegalSnapshot(owner: string, operation: string, currency: BillingCurrency, priceId: string, input: unknown) {
  const bundle = await publishedBundle(); validateAgreement(input, bundle);
  if (!bundle?.purchaseReady) throw Error("Purchases remain unavailable until withdrawal and durable-confirmation processes are reviewed");
  await accountSql`WITH purchase AS (INSERT INTO b1_legal_purchases(operation,user_id,product,terms_id,privacy_id,currency,amount,price_id,receipt)
  SELECT ${operation},${owner},${PERSONAL_PRODUCT},t.id,p.id,${currency},${annualPrices[currency]},${priceId},jsonb_build_object('terms',t.content,'termsHash',t.content_hash,'privacy',p.content,'privacyHash',p.content_hash,'agreementStatement',${bundle.statement}::text,'termsAcceptance',true,'privacyNoticeAcknowledgment',true,'offer',jsonb_build_object('currency',${currency}::text,'amountMinor',${annualPrices[currency]}::integer,'priceId',${priceId}::text,'interval','year','chargedNow',true,'renewsUnlessCanceled',true),'paymentStatementVersion','annual-purchase-1')
  FROM b1_legal_active a JOIN b1_legal_documents t ON t.id=a.terms_id JOIN b1_legal_documents p ON p.id=a.privacy_id
  WHERE a.product=${PERSONAL_PRODUCT} AND a.locale='en' AND a.purchase_ready=true AND a.statement_version=${bundle.statementVersion} AND t.id=${bundle.terms.id} AND p.id=${bundle.privacy.id} AND t.status='published' AND p.status='published' AND (t.content->'offer'->'annualPrices'->>${currency})::integer=${annualPrices[currency]}
  ON CONFLICT(operation) DO NOTHING RETURNING *)
  INSERT INTO b1_legal_acceptances(id,user_id,product,context,locale,terms_id,privacy_id,terms_hash,privacy_hash,statement_version,statement,terms_accepted_at,privacy_acknowledged_at,receipt)
  SELECT 'purchase:'||operation,user_id,product,'purchase','en',terms_id,privacy_id,receipt->>'termsHash',receipt->>'privacyHash',${bundle.statementVersion},${bundle.statement},presented_at,presented_at,receipt FROM purchase`;
  const existing = await accountSql`SELECT * FROM b1_legal_purchases WHERE operation=${operation} AND user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  if (!existing[0] || existing[0].currency !== currency || existing[0].price_id !== priceId) throw Error("Pending purchase legal information could not be confirmed");
  return existing[0];
}
export async function deletePendingLegal(owner: string) {
  try {
    await accountSql`DELETE FROM b1_legal_signup_reservations WHERE intended_user_id=${owner}`;
    await accountSql`DELETE FROM b1_legal_signup_choices WHERE intended_user_id=${owner}`;
  } catch (error) {
    // Account deletion must still work before this additive migration is installed.
    if ((error as { code?: string }).code !== '42P01') throw error;
  }
}
export async function cleanupPendingLegal() {
  // Expired proof + bounded retry interval. No indefinite anonymous acceptance tracking.
  await accountSql`DELETE FROM b1_legal_signup_reservations r USING b1_email_attempts e WHERE r.attempt_id=e.id AND e.expires_at<now()-interval '24 hours'`;
  await accountSql`DELETE FROM b1_legal_signup_choices c USING b1_email_attempts e WHERE c.attempt_id=e.id AND e.expires_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM b1_legal_signup_reservations r WHERE r.choice_id=c.id)`;
}
