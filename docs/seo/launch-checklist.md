# ManForth SEO deployment and measurement handoff

The initial SEO implementation was prepared on 2026-10-04. The launch status below records the later live setup; the remaining checklist is reference material from the initial handoff.

## Google launch status — checked 2026-10-11

- Published only `public/googled15b2944d0cba7c7.html` in commit `a55f621`. Its hosted URL returns HTTP 200 and exactly matches Google's downloaded verification file.
- Google confirmed ownership of the URL-prefix property `https://b1-way-mf.vercel.app/` under the user's approved, signed-in Google account.
- Submitted `https://b1-way-mf.vercel.app/sitemap.xml` on 2026-10-10. On 2026-10-11, Search Console shows **Success**, five discovered pages and a last-read date of 2026-10-10. The initial fetch warning is resolved.
- On 2026-10-11, URL Inspection for `https://b1-way-mf.vercel.app/` confirms **URL is on Google** and **Page is indexed**. The earlier "URL unknown to Google" status is resolved. This confirms the homepage's indexing, not a particular query ranking or that all five pages are indexed.
- The manual homepage indexing request on 2026-10-10 was rejected by Google's daily quota. No new indexing request was sent on 2026-10-11 because Google had already indexed the homepage.
- The homepage, Help and all three feature pages return 200 and allow indexing. Private/account/API indexing exclusions remain in place.

## Before deployment

- The 2026-10-11 feature expansion adds public Notes, money tracker, To-Do and investment tracker pages, extends calendar/events and gym/activity wording, and updates homepage/Help copy and WebApplication features. Its sitemap contains nine URLs. This local expansion has not yet been deployed; the dated five-page Google status above describes the earlier live version.

- Review this focused public-site diff alongside the ongoing native work; preserve the separate language product and private modules.
- Build on the intended Vercel **production** deployment (`NODE_ENV=production`, `VERCEL_ENV=production`). Preview builds deliberately use noindex and an empty sitemap. Do not promote a cached preview build as production without rebuilding.
- Confirm canonical identity stays `https://b1-way-mf.vercel.app`. `NEXT_PUBLIC_SITE_ORIGIN` is legacy/ignored for discovery metadata. No custom-domain migration was performed.
- Enable appropriate preview deployment protection in Vercel as owner. Code noindex is additional protection, not authentication.
- Keep legal publication, registration eligibility, email readiness, actual trial starts and purchase readiness under their existing controls. They were not relaxed for SEO.
- Current code has no visible manual billing-currency selector. Existing explicit-currency server checks and paid-currency preservation remain; do not advertise a manual-selector journey as shipped. Treat restoring that UI as a separate product task.
- Confirm current mailbox ownership/delivery separately if needed. SEO kept `support-mf@b1-way.pl`; it did not send a verification message or replace provider configuration.

## After an authorized deployment

1. Anonymous GET checks: `/`, `/help`, all seven `/features/*` pages listed in `lib/seo/public-pages.ts`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/favicon.ico` and `/manforth/apple-touch-icon.png`. `scripts/seo-public-audit.mjs` prints results to the terminal without creating command logs in the repository.
2. Check status/content type, distinct titles/descriptions, each self-canonical, index/follow on the nine approved pages and no accidental global noindex on production.
3. Confirm robots allows public/auth/legal/rendering assets, excludes private/API surfaces and names the production sitemap. Sitemap should contain exactly nine preferred URLs, without draft/legal/account/API/token URLs.
4. Check login/registration/recovery and private/API routes carry noindex. An anonymous account request must redirect to login without leaking records. Confirm unknown paths return real 404s.
5. On phone and desktop, check carousel controls and pause, initial artwork, full feature copy, keyboard skip link, Q&A, feature links and trial destination. Validate reduced motion and real-device interactions; viewport-only testing does not emulate all device capabilities.
6. Check all four configured fixed prices and account confirmation on isolated fixtures. Confirm private/no-store offer/account responses and paid-subscription currency. No real charge is needed for SEO validation.
7. Inspect social previews in the intended sharing tools. The PNG is generated from local approved art with separately rendered brand copy; favicon and Apple PNG use the existing MF mark.
8. Run external Schema Markup Validator / Google's Rich Results Test if useful, but distinguish valid schema from feature eligibility. There is no qualifying rating/review or published Offer markup, so no software-app rich-result eligibility is claimed. Useful Q&A remains without FAQPage/QAPage markup.

## Search Console procedure — reference

Use the **URL-prefix property** for `https://b1-way-mf.vercel.app/`, not ownership of `vercel.app` itself. Keep Google's published verification file in place so ownership remains verified.

After verification and deployment:

- Submit `https://b1-way-mf.vercel.app/sitemap.xml`.
- Inspect the homepage, Help and each feature URL: fetch/render, indexing eligibility and declared versus Google-selected canonical.
- Request indexing where appropriate; then monitor actual indexing/error reports. A submission or request is not a guarantee of indexing.
- Inspect excluded auth/private/draft surfaces for accidental indexing. Do not expose private content to a bot user agent.
- Optionally verify the same property with Bing Webmaster Tools.

At the initial handoff, Search Console access and deployed retrieval were unverified. The dated launch status above supersedes those observations. Rankings, organic traffic and Rich Results Test results remain unverified.

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
