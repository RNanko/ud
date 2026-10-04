# ManForth focused SEO implementation

Implemented and checked on 2026-10-04, Europe/Warsaw. This is a local repository upgrade, not a deployment, legal publication or indexing/ranking certification.

## Revision and safeguards

- HEAD: `60f09b7c278934e3a8d89fa08be5b60dbbe101df`; branch: `codex/manforth-stabilization-audit`. Changes are uncommitted. The workspace already contained substantial web repairs and ongoing native/API work; those were preserved. See the scoped [file hashes](artifacts/seo-file-hashes.json) for this delivery.
- Next 16.3.8 App Router / Cache Components, React 19.3.0, TypeScript, existing Tailwind/CSS tokens and Node test runner. Read the installed metadata, robots, sitemap, image/icon, JSON-LD and headers guides before editing. No alternate head manager, framework or dependency installation.
- Used anonymous HTTP and browser visits on an isolated production-mode server at `127.0.0.1:3100`, with the database connection replaced by an unavailable local fixture address. No cookies were supplied by the HTTP script. No database mutation, provider job, signup, OTP send, email, trial start, payment, external-account setup or deployment was performed.
- Private module/auth/billing/native code was not changed by the SEO pass. Auth/account routes retain their real authentication and ownership controls; noindex/robots are additional discovery policy only. The separate language product was untouched.
- Existing QA reports were read and checked against the current tree, rather than treated as proof. An initial auth test failed because the new Expo boundary had no mock; concurrent native work supplied that mock. The final suite passes. An initial standalone type check overlapped build-generated route types; its sequential rerun passed. Neither was repaired by weakening auth.
- Concurrent native QA added a development-only output-directory rule to the shared Next configuration after the first final checks. It was preserved, and the production build, type check, lint, test suite and anonymous production HTTP checks were repeated on the combined configuration. One lint rerun was interrupted because it scanned generated QA bundles; `eslint.config.mjs` now excludes that output directory alongside `.next`, and the final rerun covers source files. Anonymous browser session lookups encountered the deliberately unavailable fixture database; no successful authenticated database journey is claimed.

## Observed baseline and delivered fixes

| Observation from source / local production response | Change and evidence |
| --- | --- |
| Generic homepage metadata; no coherent structured-data graph; Help lacked complete social metadata | Accurate stable homepage title/description, common typed metadata helper, five distinct self-canonical page identities and social cards. [HTTP checks](artifacts/final-http.json), [domain tests](artifacts/seo-tests.log). |
| Public canonical origin accepted a preview environment value | Pin public discovery identity to the approved Vercel origin. Tests inject a hostile preview URL and verify it is ignored. Auth origins remain independent. |
| Public auth URLs were robots-blocked while relying on noindex metadata | Allow crawling public auth/legal screens; add noindex response headers for excluded surfaces. Private/API routes remain crawl-excluded and authenticated. Actual production and preview builds checked. |
| Sitemap contained only root/Help, with arbitrary monthly changefreq and priority | Shared five-page allowlist; no invented priority, changefreq or lastmod; preview sitemap empty. Valid framework XML/text content types and public 200 responses checked. |
| No public feature explanation routes; every feature card used the same preview anchor | Add only three substantive pages: workouts, weekly planning and goals. Cards/footer/Help link to relevant public explanations; Finance/Investments keep their module-aware local demo actions. All sections remain ordinary HTML. |
| Homepage all-six feature copy and Q&A answers were already in server HTML | Preserve that strength. Feature pages reuse the Help registry, existing QuestionAnswer, Card, Button/trial actions, header/footer and blue/orange theme. No answer-per-URL expansion or bot-only content. |
| First hero already used a responsive picture, eager/high priority image and intrinsic dimensions | Preserve first-image delivery, five supplied scenes, manual/pause controls and reduced-motion logic. Verify all 15 responsive assets resolve, five scenes retain the same hero height and metadata. |
| Public demo imported private Momentum UI, bringing unrelated dialog/motion code into its dependency graph | Use the same surface classes without importing private dialogs; dynamically import the interactive demo when it enters view. Server-readable preview/workflow/features remain available without JS. Failed chunk state keeps readable examples and offers retry. |
| Social preview was unbranded category artwork at 1672×941; declared SVG/icon assets were not centrally rendered into the existing ICO | Build a real 1200×630 PNG with Next ImageResponse, approved local art and separately rendered copy; optimize with Next's installed sharp. Re-render favicon/Apple PNG from existing MF SVG. No new artwork or hotlinks. |
| Legacy personal author/creator metadata had no verified public authorship context in the brief | Remove those unsupported attribution fields; do not invent a legal publisher/Organization, expert or review. |
| Public offer resolved one region at a time | Keep the existing resolver and private/no-store boundary. Add visible compact all-four configured annual prices from the existing price registry. Do not alter checkout, paid currency or trial behavior. |

## Delivered files and content boundaries

- Metadata/discovery: `lib/brand.ts`, `lib/seo/{public-pages,metadata,structured-data}.ts`, root layout, `app/robots.ts`, `app/sitemap.ts`, `next.config.ts`, legacy-origin comments in `.env.example`.
- Public content/composition: homepage, Help, three explicit `/features/*/page.tsx` routes, `lib/seo/features.ts`, shared FeatureArticle, PublicFeatureLinks and PublicStructuredData. Existing landing cards/header/footer/provider/styles reused.
- Delivery/performance: DeferredAppPreview and read-only StaticAppPreview; existing interactive AppPreview retained, with private Panel dependency removed. Original carousel/art assets retained. Only public scoped CSS was added.
- Images: `app/opengraph-image.tsx`, branded `app/favicon.ico`, local Apple PNG, repeatable `scripts/seo-icons.mjs` using installed sharp.
- Verification: nine SEO tests, anonymous `scripts/seo-public-audit.mjs`, build/check/browser artifacts and the four handoff documents.

JSON-LD uses stable WebSite / WebPage / WebApplication / visible BreadcrumbList identities. Script-safe serialization escapes `<`, `>`, `&` and line separators. No Organization, invented rating/review, Offer, private Event, mobile operating-system/store claim or FAQPage/QAPage block. Checkout publication/availability and qualifying rating evidence are not established; therefore software-app rich-result eligibility is **not** claimed.

Support stays `support-mf@b1-way.pl`. Legal readers, accepted historical text, publication gates and account/notification channels were not rewritten. Only internal notifications are described. Money goals are explicitly manual Momentum records; no automatic Finance/Investment linking, brokerage, guaranteed returns or automatic step sensing is advertised. Exercise weights/repetitions remain user choices; public targets are labeled illustrations.

## Actual asset sizes

| Asset | Format / dimensions | Bytes |
| --- | --- | ---: |
| `/opengraph-image` | Optimized PNG, 1200×630 | 294,404 |
| `/favicon.ico` | ICO with 16/32/48 PNG entries | 1,843 |
| `/manforth/apple-touch-icon.png` | PNG, 180×180 | 3,099 |
| Existing `/manforth/mark.svg` | SVG, viewBox 64×64 | 278 |

Total icon payload: **5,220 bytes**; social PNG plus those icons: **299,624 bytes**. The social PNG is not an initial page image. All 15 existing WebP variants returned 200 with WebP content/signatures. Hero art sizes remain covered by the existing ManForth asset tests. [Actual social asset](artifacts/social-preview.png).

## Before/after diagnostics

Same local machine, production mode, anonymous unthrottled Node fetch; one warm-up and seven warm requests. Initial script list comes from raw HTML; decoded byte lengths and `gzipSync` sizes are summed. This excludes dynamically imported code after the demo becomes visible and is not browser transferred-byte accounting or a total-session budget. Ambient machine load was not controlled.

| Diagnostic | Baseline | Final |
| --- | ---: | ---: |
| Raw homepage HTML | 98,813 B | 95,374 B |
| Calculated gzip HTML | 15,498 B | 16,358 B |
| Scripts referenced by initial HTML, decoded | 930,421 B | 673,273 B |
| Calculated gzip of those scripts | 293,019 B | 208,815 B |
| Median warm time to response headers | 5.225 ms | 5.436 ms |
| Initial default desktop DOM nodes, browser snapshot | 678 | 582 |
| Hero height at same default viewport | 760.726 px | 760.726 px |

Initial referenced-script gzip payload fell about **28.7%**. HTML gzip grew with the useful content/schema. Warm HTTP timing did not improve and is not a meaningful real-user speed conclusion. [Baseline](artifacts/baseline-http.json), [final](artifacts/final-http.json), [baseline browser](artifacts/baseline-browser.json), [final browser](artifacts/final-browser.json).

Browser performance entries were unavailable through the supplied read-only browser API. No Lighthouse, throttled navigation, browser LCP/INP/CLS or field measurement was executed. Stable rectangles across the five scenes are useful layout evidence, **not** a measured CLS score. Field Core Web Vitals remain Unknown.

## Checks actually executed

| Check | Result / limits |
| --- | --- |
| `npm test` final | **292 tests passed, 0 failed, 0 skipped**; includes nine new SEO tests and existing auth, billing, currency/cache, dates, gym/planner/history and native boundary fixtures. Synthetic/mocked boundaries; no live provider/DB journey. [Log](artifacts/final-tests.log). |
| `npx tsc --noEmit`, after final build | Passed. [Log](artifacts/final-types.log). |
| `npm run lint` final | Passed, no warnings/errors in final run. An earlier run observed an unrelated native script warning which concurrent native work subsequently removed. [Log](artifacts/final-lint.log). |
| `VERCEL_ENV=production npm run build` | Passed; five public pages and social image prerendered; private/native routes preserved. [Log](artifacts/final-build.log). |
| Separate `VERCEL_ENV=preview npm run build` | Passed, followed by real preview-server HTTP assertions: noindex headers/metadata, empty sitemap and stable production canonicals. Production build restored afterwards. [Build](artifacts/preview-build.log), [HTTP](artifacts/preview-http.log). |
| `node scripts/seo-public-audit.mjs http://127.0.0.1:3100 final` | Passed: public statuses/HTML/meta/schema, no broken home anchors, all approved sitemap URLs, auth/private/legal exclusions, anonymous account redirect, real missing-route 404s, query-stable metadata, 15 WebPs, PNG dimensions, ICO signature and private/no-store EUR offer fallback. [Log](artifacts/final-http.log). |
| Browser, five public pages | No horizontal overflow at 390×844 and 1440×900 viewport settings (content width excludes scrollbar). [Mobile](artifacts/mobile-routes.json), [desktop](artifacts/desktop-routes.json). |
| Browser keyboard/demo | Skip link focuses main; Enter opens shared Q&A. Deferred interactive demo loads when viewed, completes 2/3→3/3 once and resets to 2/3. Anonymous trial destination renders registration; no form submitted and readiness gates remain. |
| Browser art/layout | All five scenes switch with identical hero height and stable title/canonical. [Scene records](artifacts/hero-scenes-check.json). Mobile/desktop public explanation screenshots and generated social image visually inspected. |
| Browser bounded error/warning log | Empty at the recorded check, not a whole-app console guarantee. [Log](artifacts/browser-log-check.json). |

At 1440px, the screenshot tool twice failed to capture; DOM/overflow checks still completed. After restoring the default viewport, desktop capture succeeded and was visually inspected. [Desktop preview](artifacts/workout-desktop.png), [mobile preview](artifacts/workout-mobile.png). No auth form submission, live billing, real-device reduced-motion emulation or private account E2E was performed; existing isolated regression fixtures provide those code-boundary checks.

## External checks and remaining work

- Anonymous deployed root/Help/robots/sitemap/missing-route retrieval through Node failed; web tool retrieval also failed for root/robots/sitemap. [Recorded attempts](artifacts/deployed-baseline.json). **Live deployed status is unverified**, not a proven missing file or site outage. No live revision parity is claimed.
- Search Console ownership/token/access, URL Inspection, sitemap submission, Google-selected canonical, indexing, ranking, demand, organic visits and conversions: **Unknown / not performed**.
- No external Rich Results Test or Schema Markup Validator result is claimed. JSON parse/content-safety and identity checks passed locally.
- No visible manual billing-currency selector exists in the inspected product. Explicit currency server checks and existing-subscription preservation pass fixtures; a full manual-selection UI remains a separate product gap. It was not introduced or changed by SEO.
- Legal/operator facts, publication and email/checkout launch readiness remain under the existing gates. No external reminder/native-release claims were added.
- See [route policy](public-route-map.md), [intent/content map](content-and-query-map.md) and [owner launch checklist](launch-checklist.md). The safe repository changes are complete; external deployment/configuration/field-data work remains with the owner.

## Guidance checked

The installed Next guides are authoritative for the code. Its static public metadata resolves at build time; its dynamic metadata may stream, with built-in handling for HTML-limited bots. No custom user-agent cloaking or content change was added.

- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): useful readable content and normal links; no hidden keywords or guaranteed snippet/ranking promises.
- [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [noindex crawl access](https://developers.google.com/search/docs/crawling-indexing/block-indexing): distinct self-canonicals and crawl-visible public exclusions.
- [Localized pages](https://developers.google.com/search/docs/specialty/international/localized-versions): actual translations only; pricing is not a language route.
- [Software-app requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app), [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) and [site names](https://developers.google.com/search/docs/appearance/site-names): honest visible facts and stable ManForth site identity, without fabricated ratings/company facts.
- [Official update log](https://developers.google.com/search/updates): confirmed FAQ rich results stopped appearing May 7, 2026. Visible Q&A retained without the retired-feature promise.
- [Web Vitals](https://web.dev/articles/vitals), [Search Console properties](https://support.google.com/webmasters/answer/34592), [AI search features](https://developers.google.com/search/docs/appearance/ai-features) and [Next metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images): field versus lab distinctions, owner URL-prefix setup and no special AI markup promise.
- The requested Google build-sitemap reference could not be retrieved through the web tool after two attempts. Sitemap implementation/escaping and content type were verified with the installed Next sitemap guide and actual HTTP/XML output; no successful external-guide retrieval is claimed.
