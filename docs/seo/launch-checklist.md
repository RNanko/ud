# ManForth SEO deployment and measurement handoff

Code changes are local and uncommitted. This task did **not** deploy, configure external accounts, submit a sitemap, verify Search Console, publish legal documents, send email or take a payment.

## Before deployment

- Review this focused public-site diff alongside the ongoing native work; preserve the separate language product and private modules.
- Build on the intended Vercel **production** deployment (`NODE_ENV=production`, `VERCEL_ENV=production`). Preview builds deliberately use noindex and an empty sitemap. Do not promote a cached preview build as production without rebuilding.
- Confirm canonical identity stays `https://b1-way-mf.vercel.app`. `NEXT_PUBLIC_SITE_ORIGIN` is legacy/ignored for discovery metadata. No custom-domain migration was performed.
- Enable appropriate preview deployment protection in Vercel as owner. Code noindex is additional protection, not authentication.
- Keep legal publication, registration eligibility, email readiness, actual trial starts and purchase readiness under their existing controls. They were not relaxed for SEO.
- Current code has no visible manual billing-currency selector. Existing explicit-currency server checks and paid-currency preservation remain; do not advertise a manual-selector journey as shipped. Treat restoring that UI as a separate product task.
- Confirm current mailbox ownership/delivery separately if needed. SEO kept `support-mf@b1-way.pl`; it did not send a verification message or replace provider configuration.

## After an authorized deployment

1. Anonymous GET checks: `/`, `/help`, the three `/features/*` pages, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/favicon.ico` and `/manforth/apple-touch-icon.png`.
2. Check status/content type, distinct titles/descriptions, each self-canonical, index/follow on the five approved pages and no accidental global noindex on production.
3. Confirm robots allows public/auth/legal/rendering assets, excludes private/API surfaces and names the production sitemap. Sitemap should contain exactly five preferred URLs, without draft/legal/account/API/token URLs.
4. Check login/registration/recovery and private/API routes carry noindex. An anonymous account request must redirect to login without leaking records. Confirm unknown paths return real 404s.
5. On phone and desktop, check carousel controls and pause, initial artwork, full feature copy, keyboard skip link, Q&A, feature links and trial destination. Validate reduced motion and real-device interactions; viewport-only testing does not emulate all device capabilities.
6. Check all four configured fixed prices and account confirmation on isolated fixtures. Confirm private/no-store offer/account responses and paid-subscription currency. No real charge is needed for SEO validation.
7. Inspect social previews in the intended sharing tools. The PNG is generated from local approved art with separately rendered brand copy; favicon and Apple PNG use the existing MF mark.
8. Run external Schema Markup Validator / Google's Rich Results Test if useful, but distinguish valid schema from feature eligibility. There is no qualifying rating/review or published Offer markup, so no software-app rich-result eligibility is claimed. Useful Q&A remains without FAQPage/QAPage markup.

## Search Console owner steps — not completed

Use an appropriate **URL-prefix property** for `https://b1-way-mf.vercel.app/`, not ownership of `vercel.app` itself. Verify using an owner-approved supported method. No token was supplied, so no invented verification tag/integration was added.

After verification and deployment:

- Submit `https://b1-way-mf.vercel.app/sitemap.xml`.
- Inspect the homepage, Help and each feature URL: fetch/render, indexing eligibility and declared versus Google-selected canonical.
- Request indexing where appropriate; then monitor actual indexing/error reports. A submission or request is not a guarantee of indexing.
- Inspect excluded auth/private/draft surfaces for accidental indexing. Do not expose private content to a bot user agent.
- Optionally verify the same property with Bing Webmaster Tools.

No Search Console property/access, sitemap submission, URL Inspection, indexing coverage, rankings, organic traffic or Rich Results Test outcome was established by this task. Deployed HTTP retrieval failed through the available tools, which does not prove deployed robots/sitemap files are missing.

## Measurement

Field LCP, INP and CLS are Unknown. Good real-user targets are LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at the 75th percentile, segmented by mobile/desktop. Local unthrottled HTTP diagnostics and viewport rectangles are not field Core Web Vitals or real-user INP.

When owner-approved measurement is available, review impressions, relevant queries, clicks, indexed preferred URLs, errors and conversion stages independently:

| Stage | Meaning |
| --- | --- |
| Organic landing visit | Attributed page visit |
| Signup/trial CTA click | Intent only |
| Completed registration | Account creation actually completed |
| Actual trial start | Explicit server-confirmed trial activation |
| Confirmed purchase | Provider-confirmed paid entitlement |

Missing analytics is Unknown, not zero. No new analytics/ad tags, private financial/training/task telemetry, paid SEO services, outreach or purchased links were added.

Promote the real product through owner-led demonstrations, relevant existing profiles and useful reviewed product content. No special AI file/schema is required, and no llms.txt/ranking guarantee was added. A future custom-domain migration, if separately chosen, needs equivalent redirects, self-canonicals, sitemap/property updates and post-migration inspection; the unrelated language domain must remain untouched.
