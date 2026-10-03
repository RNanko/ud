import Link from "next/link";
import Brand from "../shared/Brand";
import LandingFooter from "../landing/LandingFooter";
import { brand } from "@/lib/brand";
import { publicDocument } from "@/lib/legal/store";
import { contentHash } from "@/lib/legal/validation";
import type { LegalKind } from "@/lib/legal/types";
import LegalActions from "./LegalActions";
import "../../(root)/landing.css";
import "./legal.css";

export default async function LegalReader({ kind, version }: { kind: LegalKind; version?: string }) {
  const result = await publicDocument(kind, version);
  return <div className="mf-landing legal-scope">
    <header className="mf-header"><Link href="/" className="mf-brand"><Brand /></Link><nav aria-label="Legal page navigation"><Link href="/help">Help & Q&A</Link><Link href="/auth/login">Sign in</Link></nav></header>
    <main id="main-content" className="legal-main">
      <Link href={kind === "privacy" ? "/terms" : "/privacy"} className="legal-other">{kind === "privacy" ? "Terms & Conditions" : "Privacy Policy"} →</Link>
      {!result ? <article><h1>{kind === "privacy" ? "Privacy Policy" : "Terms & Conditions"} — ManForth by B1-Way</h1><p>Reviewed documents are awaiting publication. New registration and purchases requiring these documents are unavailable. Existing account security, billing management, support, export and deletion remain available.</p><p><a href={`mailto:${brand.supportEmail}`}>Contact support</a></p></article> : <>
        {result.draft && <div role="status" className="legal-draft"><strong>Development review draft — not approved or published</strong><p>Operator facts and legal decisions are unresolved. This draft cannot authorize registration or purchase. Bracketed review notes are visible only in this development preview.</p></div>}
        <header className="legal-heading"><p className="mf-eyebrow">ManForth · by B1-Way</p><h1>{result.document.title}</h1><p>{result.document.introduction}</p><dl><div><dt>Version</dt><dd>{result.document.version}</dd></div><div><dt>{result.draft ? "Proposed effective date" : "Effective date"}</dt><dd>{result.document.effectiveDate}</dd></div><div><dt>Last updated</dt><dd>{result.document.updatedAt}</dd></div><div><dt>Language</dt><dd>English · web</dd></div></dl><LegalActions document={result.document} /></header>
        <div className="legal-layout"><nav aria-label="Document contents" className="legal-toc"><h2>Contents</h2>{result.document.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav><article className="legal-content">{result.document.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((text, index) => <p key={index}>{text}</p>)}</section>)}<section id="versions"><h2>Published versions</h2>{result.history.length ? <ul>{result.history.map(item => <li key={item.version}><Link href={`/${kind}/${item.version}`}>{item.version}</Link> · effective {item.effectiveDate}</li>)}</ul> : <p>No published versions yet. Drafts are not historical agreements.</p>}</section><p className="legal-hash">SHA-256: {contentHash(result.document)}</p></article></div>
      </>}
    </main><LandingFooter home={false} />
  </div>;
}
