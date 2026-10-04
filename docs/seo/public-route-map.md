# ManForth public route and indexing policy

Implemented 2026-10-04 against the uncommitted web/native workspace. Preferred origin: **https://b1-way-mf.vercel.app**. English content, lowercase routes, no trailing slash except the equivalent root URL. Next serializes the root canonical without its trailing slash; both forms resolve to the same URL identity.

## Approved discovery pages

| Route | Purpose | Production policy | Canonical |
| --- | --- | --- | --- |
| `/` | Combined personal-development planner | index, follow | production root |
| `/help` | Substantive shared public Q&A | index, follow | same route |
| `/features/workout-planner` | Templates, weekly plans and actual training logs | index, follow | same route |
| `/features/weekly-planner` | Events, optional times, presets and task workflow | index, follow | same route |
| `/features/goal-tracker` | Momentum periods, recorded actions and review | index, follow | same route |

`lib/seo/public-pages.ts` is the shared sitemap/link allowlist. Only these five URLs are included. There are no invented lastmod, priority or changefreq values. No arbitrary database records, exercise catalogue pages or query strings are enumerated.

## Excluded surfaces

| Surface | Protection / policy |
| --- | --- |
| `/account/**`, including inbox, dashboards, records and exports | Existing proxy/authentication and ownership checks unchanged. noindex/nofollow metadata plus response header; robots crawl exclusion. No public account records. |
| `/auth/**`, including login, registration, recovery, reset and callbacks | Crawlable public entry screens; noindex/nofollow metadata and response header. Removed the auth robots block so crawlers can see the directive. Tokens are not included in public links, metadata or sitemaps. |
| `/api/**`, including native APIs and provider callbacks | noindex/nofollow response header and robots crawl exclusion. Existing authorization/signature policies remain the actual protection. |
| `/terms`, `/privacy` and historical `/[version]` variants | Remain noindex and outside the sitemap. Existing reader, immutable accepted content, publication gates and canonical behavior are unchanged. The response header also excludes all versions. Legal documents remain accessible via public links. |
| Search/filter, carousel and currency parameters | No new routes. Homepage metadata has a stable canonical and title; Help filtering stays client-side. Functional auth/payment/signed parameters are not stripped or redirected. |
| Missing paths, including unknown feature slugs | Genuine framework 404 with noindex, never a home-screen redirect. |
| Standalone development demos / drafts | No new destinations. Public illustrations live on their parent page and are labeled example data. Keep future dev/demo routes out of the allowlist and give them noindex before exposing them. |

Legal indexing choice: current public legal readers were already noindex, with only development drafts available during the earlier audit. Keep all versions excluded for this pass; publication/legal review is a separate task. Reconsider current-document indexing only after verified publication, without rewriting accepted versions or giving history an unrelated homepage canonical.

## Deployment modes

- `NODE_ENV=production` **and** `VERCEL_ENV=production`: approved pages are indexable; headers exclude the surfaces above. No extra flag is needed on the production Vercel project.
- Development, preview, missing or unknown Vercel environment: site-wide `X-Robots-Tag: noindex, nofollow`, public page metadata noindex, empty sitemap. Public crawling is allowed so noindex can be seen. Configure Vercel deployment protection as an additional owner safeguard; it was not configured by this task.
- Public canonicals always use the approved origin, including on previews. They never read unchecked Host, preview-domain values or `NEXT_PUBLIC_SITE_ORIGIN`. That legacy environment variable is documented as ignored; auth `APP_URL` / `BETTER_AUTH_URL` remain independent.
- Preview rules are build-time configuration. Build for the intended Vercel environment; merely changing a runtime variable does not rewrite prerendered metadata.

robots/noindex are discovery instructions, **not** access control. A robots-disallowed private URL is protected by authentication regardless of what a crawler does. Public auth/legal pages are deliberately not robots-blocked. Rendering assets under `/_next` and `/manforth` remain crawlable.

There is no translated ManForth route set, so there is no hreflang or invented x-default. Prices do not create language versions. The separate B1-Way language product remains separate.
