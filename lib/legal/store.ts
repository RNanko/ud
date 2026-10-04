import "server-only";
import { PublicError } from "../account/errors";
import { publicDocuments } from "./public-content";
import { contentHash } from "./validation";
import { agreementStatement, type LegalBundle, type LegalKind } from "./types";

// Website policies use server configuration and local copy, never a database registry.
export async function publishedBundle(): Promise<LegalBundle | null> {
  const documents = publicDocuments(process.env);
  if (!documents) return null;
  const reference = (kind: LegalKind) => {
    const document = documents[kind];
    return { id: document.id, version: document.version, hash: contentHash(document), href: `/${kind}` };
  };
  return { product: "b1-way-personal", locale: "en", statementVersion: agreementStatement.version,
    statement: agreementStatement.text, terms: reference("terms"), privacy: reference("privacy"),
    // A purchase still requires current agreement and explicit checkout confirmation.
    purchaseReady: true };
}
export async function publicDocument(kind: LegalKind, version?: string) {
  const document = publicDocuments(process.env)?.[kind];
  if (!document || version && version !== document.version) return null;
  return { document, draft: false, history: [] as { version: string; effectiveDate: string }[] };
}
// Compatibility for existing owned exports. No acceptance/history records are collected.
export async function legalAccountHistory(_owner: string) {
  void _owner;
  return { bundle: await publishedBundle(), records: [], purchases: [], unavailable: false };
}
export async function purchaseLegalSnapshot(..._input: unknown[]): Promise<Record<string, unknown>> {
  void _input;
  throw new PublicError("Membership purchase is currently unavailable.");
}
// Existing cleanup calls remain safe after retiring the empty legal tables.
export async function deletePendingLegal(_owner: string) { void _owner; }
export async function cleanupPendingLegal() {}
