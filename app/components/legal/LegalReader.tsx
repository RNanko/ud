import Link from "next/link";
import Brand from "../shared/Brand";
import LandingFooter from "../landing/LandingFooter";
import { notFound } from "next/navigation";
import { publicDocument } from "@/lib/legal/store";
import type { LegalKind } from "@/lib/legal/types";
import "../../(root)/landing.css";
import "./legal.css";

export default async function LegalReader({
  kind,
  version,
}: {
  kind: LegalKind;
  version?: string;
}) {
  const result = await publicDocument(kind, version);
  if (!result || result.draft) notFound();
  return (
    <div className="mf-landing legal-scope">
      <header className="mf-header">
        <Link href="/" className="mf-brand">
          <Brand />
        </Link>
        <nav aria-label="Legal page navigation">
          <Link href="/help">Help & Q&A</Link>
          <Link href="/auth/login">Sign in</Link>
        </nav>
      </header>
      <main id="main-content" className="legal-main">
        <Link
          href={kind === "privacy" ? "/terms" : "/privacy"}
          className="legal-other"
        >
          {kind === "privacy" ? "Terms & Conditions" : "Privacy Policy"} →
        </Link>
        <>
          <header className="legal-heading">
            <p className="mf-eyebrow">ManForth · by B1-Way</p>
            <h1>{result.document.title}</h1>
            <p>{result.document.introduction}</p>
            <dl>
              <div>
                <dt>Effective date</dt>
                <dd>{result.document.effectiveDate}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{result.document.updatedAt}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>English · web</dd>
              </div>
            </dl>
          </header>
          <div className="legal-layout">
            <nav aria-label="Document contents" className="legal-toc">
              <h2>Contents</h2>
              {result.document.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.title}
                </a>
              ))}
            </nav>
            <article className="legal-content">
              {result.document.sections.map((section) => (
                <section id={section.id} key={section.id}>
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                </section>
              ))}
              {result.history.length > 0 && (
                <section id="versions">
                  <h2>Published versions</h2>
                  <ul>
                    {result.history.map((item) => (
                      <li key={item.version}>
                        <Link href={`/${kind}/${item.version}`}>
                          {item.version}
                        </Link>{" "}
                        · effective {item.effectiveDate}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          </div>
        </>
      </main>
      <LandingFooter home={false} />
    </div>
  );
}
