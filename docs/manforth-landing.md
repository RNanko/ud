# ManForth landing implementation

Implemented at `/` in the existing personal-development app. Local review: `http://localhost:3000/`. Production canonical: `https://b1-way-mf.vercel.app/`. Deployment and provider configuration were not changed.

## Reuse and scope

- Existing `Card`, `Button`, Lucide icons, typography and global blue/orange theme tokens. Landing CSS is scoped to `.mf-landing`; cinematic neutral/art colors do not replace application tokens.
- Existing Gym week navigation markup extracted into `WeekNavigatorView`. The authenticated `WeekNavigator` still reads account calendar preferences. Public fixtures use the stateless view without pulling account forms or validation into their bundle.
- Date-only calendar utilities extracted into `lib/calendar.ts` and re-exported by the existing Gym utility module. Existing week/date tests continue to pass.
- Existing Momentum `Panel` and shared To-Do text presentation. Authenticated task dragging retains its original sensors, handlers and controls; the public sample has independent whole-card dragging and keyboard lane buttons.
- Existing email-only authentication, explicit trial start, Resend delivery, Stripe Checkout/portal, webhook reconciliation and account persistence. No new database tables, authentication system, analytics SDK or UI framework.

The inspected app has Finance categories/dashboard/history/CSV export, manually entered investments with available price refresh, the To-Do board, Events/week presets, Gym templates/logging and Momentum goals/Journeys/review. Copy describes tracking and confirmed actions rather than bank/broker integration, automatic attendance detection or health scores. No language-product files or entitlements were changed. Existing account, Gym, To-Do, Events and Momentum page compositions remain in place.

## Files and integration

| Area | Implementation |
| --- | --- |
| Public composition | `app/(root)/page.tsx`, `layout.tsx`, `landing.css` |
| Presentation | `app/components/landing/`: header, carousel, app preview, feature cards/previews, Momentum fixture, annual card, three-question FAQ and footer |
| Public Q&A | `app/(root)/help/page.tsx`, `app/components/help/`, shared `lib/help/content.ts` |
| Shared identity | `lib/brand.ts`, `app/components/shared/Brand.tsx` |
| Public copy/fixtures | `lib/landing/copy.ts`, `scenes.ts`, `demo.ts` |
| Billing resolution | `lib/landing/offer.ts`, `app/api/public/offer/route.ts` |
| Owned CTA projection | `app/api/public/account/route.ts` |
| GBP billing support | Account config, billing validator/reconciliation, billing action and Membership Settings |
| Explicit admin tooling | `scripts/setup-annual-prices.ts`, `lib/landing/price-setup.ts` |
| SEO | Root metadata, shared metadata, `app/robots.ts`, `app/sitemap.ts` |
| Artwork | `public/manforth/`, central asset manifest, `scripts/prepare-manforth-art.mjs` |
| Verification | `tests/manforth.test.mjs`, `tests/help.test.mjs` plus existing application suite |

Visible auth/account headers and personal-product transactional email labels use ManForth by B1-Way. Support links, email HTML/text, generated previews and local Resend sender/reply-to settings use `support-mf@b1-way.pl`. The sender display name is ManForth by B1-Way. Production deployment settings must use the same verified mailbox. No verification email was sent during landing verification. Database/product IDs, storage keys, auth resources and merchant identity were not renamed.

`NEXT_PUBLIC_SITE_ORIGIN` controls public canonical/social links. Authentication, recovery and checkout callbacks still use the existing validated `APP_URL` / `BETTER_AUTH_URL` configuration. Do not substitute the marketing origin for those values without verifying that the same deployment handles those routes. Add exact trusted origins where needed; no wildcard Vercel-origin permission is introduced. Only Vercel production is indexable. Preview/local robots disallow crawling; authenticated/auth metadata remains noindex.

## Demo and motion integrity

The landing FAQ displays three maintained answers: what ManForth is, how the no-card trial works, and the annual price. “View all questions” and the footer's “Help & Q&A” link open public `/help`, accessible without membership or sign-in. The full page retains all twelve existing answers, adds topic filters, local search, related-answer anchors and a support email link. Trial length, annual price and support address use the same shared configuration as the app. Answers have stable IDs, category/alias/related metadata, publication status, platform, version and verification date. Search reads only this public registry. The contact link opens an email client; it does not automatically send mail. No notification, steps, account or billing behavior is changed by this focused Q&A update.

One synthetic workout occurrence connects Events, Gym and Momentum. Confirming it moves the example training goal from 2/3 to 3/3 once, including repeated clicks. Moving a plan is a date-only local action. Completion keeps actual strength results unrecorded and preserves the example plan. Reset restores the original state. Sample tasks and Journey reflection live only in React state and disappear on refresh; they never call account mutation endpoints.

Finance and investment examples are authored in USD, with dollar amounts in the landing Finance fixtures. Regional membership pricing never relabels these illustrative records or real account records. All illustrative records are labeled Example data. Lightweight public adapters never request private finance/workout/task records. App/auth links disable prefetch so simply viewing the landing does not prefetch those private pages.

Finance is the deterministic first hero scene, discoverable in initial HTML with high fetch priority and responsive sources. The next requested scene is loaded and decoded before commitment; a failed candidate preserves the current scene. Rotation uses a seven-second timer and a 650 ms opacity crossfade. Focus/manual selection stop it until Play. Hover, document visibility and intersection state pause it temporarily. Reduced-motion and coarse-pointer users start with manual navigation; swipe preserves vertical scrolling. No video, WebGL or new animation dependency is loaded for the landing.

## Currency, caching and persistence

Fixed annual amounts, in minor units: PLN 4000; GBP/USD/EUR 1000. These are independent price points, not exchange-rate conversion. Finance supports PLN/EUR/USD; investments remain USD. Shared trial configuration defaults to 14 days without a card. Navigation opens the existing explicit confirmation; it does not start a trial or create billing objects.

New purchases use trusted country pricing, then EUR for unknown/unsupported regions. Landing and Account Membership Settings have no currency selector. Existing paid membership currency takes precedence over geography. The existing billing validator requires the configured fixed annual amount, so the landing uses that amount; future grandfathered price support would also need a recorded renewal-amount projection rather than geographic repricing.

Country mapping: PL → PLN, GB → GBP, US → USD; other, missing, malformed or untrusted → EUR. Only deployments with Vercel's server-set `VERCEL=1` accept `x-vercel-ip-country`. Ordinary local requests cannot override pricing through this header. Do not set `VERCEL=1` on a self-hosted public server unless its trusted ingress overwrites that header. No browser language/timezone, GPS, third-party IP lookup, city, coordinates or raw-IP logging is used. This chooses the fixed annual offer currency; it does not establish tax residence or access eligibility. [Vercel country-header reference](https://vercel.com/docs/headers/request-headers).

The regional offer endpoint is GET-only and does not set a preference cookie. Legacy manual-currency cookies are ignored. No country/location is persisted. Landing and Membership Settings resolve independently through the same first-party endpoint, so signup does not require carrying a preference. Account purchase controls stay disabled until the offer resolves (EUR fallback on failure) and require explicit confirmation of the displayed annual amount. Existing paid currency wins either response order. Missing Stripe price configuration disables purchase rather than silently charging a different currency.

The public root is statically rendered with a stable EUR fallback and no regional/account data in its cache. Two separate minimal first-party GET endpoints return private, no-store responses with CDN and Vercel CDN no-store headers. Offer/account failures leave the headline and signup usable. There is no generic `Vary` assumption. The account projection returns only CTA state and paid currency; it performs owned reads and catches unavailable dependencies.

CTA destinations: anonymous signup with trial intent; unverified Account verification; verified/eligible Membership trial confirmation; active access Momentum; expired Membership. Success URLs do not grant access. Server-selected price IDs, existing pending-checkout protection and signed-webhook activation remain authoritative. A pending checkout cannot silently change currency; users must explicitly close it and confirm a replacement. Fixed Checkout sets `adaptive_pricing.enabled=false`. [Stripe Adaptive Pricing reference](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing).

## Stripe setup

Both existing `STRIPE_ANNUAL_PRICE_<CURRENCY>` and equivalent `STRIPE_PRICE_ANNUAL_<CURRENCY>` names are accepted. Existing names take precedence. Keep product/customer/subscription IDs and correct existing prices unchanged. Use test credentials first, and keep test/live deployment configuration separate.

Read-only price audit, with environment loaded through the existing dotenv setup:

```powershell
node --import tsx scripts/setup-annual-prices.ts
```

Explicit GBP provisioning, only after configuring the existing personal-development Stripe product:

```powershell
node --import tsx scripts/setup-annual-prices.ts --create-gbp
```

The script validates product/price environment, active state, currency, amount, yearly interval/count and inclusive tax behavior. It searches for a matching existing GBP price before creating one with a stable idempotency key. It does not create missing PLN/EUR/USD prices or replace subscriptions. A reviewed live run additionally requires `--live-reviewed`. Save its returned GBP Price ID into the same environment. Page requests never provision prices.

Current local configuration has no annual Price IDs for any of the four currencies and live launch is not enabled. No provider price audit/provisioning or real Stripe test checkout was executed. Missing/mismatched configuration is reported as unavailable, with no fallback charge in another currency.

## Executed checks

- `npm test`: **213 passed, 0 failed**. Includes owned account projection, trust/country resolution, private cache headers, stale-cookie exclusion, paid-currency fetch ordering, offer-error/abort fallback and exact displayed checkout currency, CTA mapping, idempotent linked demo, all four checkout currencies through the actual server action with a mocked provider, GBP validator failures, sender identity, asset byte checks and carousel timing/failure/reduced-motion tests. Existing account, dates, workout and task tests also pass.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run lint`: passed with **0 errors and 1 existing warning** in `app/not-found.tsx` about `window.location.href` navigation.
- `npm run build`: production build passed; `/` is static and public offer/account routes are dynamic. The payload artifact below records the initial landing baseline; it is not a new measurement of this typography/pricing revision.
- Browser: mobile and desktop rendering inspected; manual scenes, linked completion/reset, automatic EUR membership price without a selector, USD Finance fixtures, updated support link, keyboard task movement, FAQ Enter/Space and mobile menu tested. Mobile document has no horizontal overflow. First mobile source is the 138,908-byte Finance WebP. Saved screenshots accompany delivery.
- Carousel hook tests cover focus, hover, offscreen/hidden state, cleanup, coarse pointers, reduced motion and failed candidates. Real touch hardware/swipe and a production CDN were not available for separate end-device verification.

These are local/lab checks, not a claim of real-user Core Web Vitals. The browser's read-only inspection did not expose PerformanceObserver/performance metrics; Lighthouse, axe and field LCP/CLS measurements were not executed. No real signup, trial start, charge or email send was performed just to test navigation. The local dev server resolves the current signed-in verification CTA. The standalone local production server encountered a backend session/database transport failure for the browser's session, so its safe anonymous fallback was verified; production owned-session/provider journeys still require the configured deployment.

### Initial landing production payload baseline

Reproduce with `node scripts/measure-manforth.mjs http://localhost:3001` while `npm run start -- --port 3001` is running. The full measured report is `docs/manforth-lab.json`.

| Measured item | Result |
| --- | ---: |
| Root decoded HTML | 102,585 bytes |
| Initial script references | 15 files |
| Decoded script payload | 925,108 bytes |
| Script gzip estimate (zlib, not actual wire transfer) | 290,610 bytes |
| Decoded CSS payload | 179,239 bytes in 2 files |
| CSS gzip estimate | 29,447 bytes |
| First mobile hero | 46,302 bytes |
| Cold local request headers | 407.8 ms |
| Four following local request header samples | 4.3–6.3 ms |

The stateless week-view extraction reduced the measured script collection from 1,321,920 to 925,108 decoded bytes, about 30%. The first Finance image and its mobile source/high priority are present in initial HTML. Root static cache was `s-maxage=31536000`; separate offer/cache headers were `private, no-store, max-age=0`, plus both CDN no-store headers. Local spoofed GB resolved EUR. These measurements cover server responses and asset bytes, not browser interaction latency or real-user performance.

Rendered checks used a 375 CSS-pixel mobile document and a 1265 CSS-pixel desktop document. Both had no horizontal page overflow. On the desktop, Finance → Gym preserved the 470 px headline width, approximately 178.5 px headline height, 470 px action-row width and 750 px hero height. This geometry comparison demonstrates that transition, not a measured CLS score. The reviewed desktop browser had zero captured console errors. Screenshots are saved in the task's visualization folder.

## Launch dependencies

1. Deploy this repository to the requested personal-development Vercel project; verify root, callbacks, exact auth trusted origin, metadata and real country headers/caches there. Deployment/DNS/auth-provider settings were not changed here.
2. Review the generated artwork and typographic identity. Five original delivered scenes are present, but editorial/brand approval is not asserted. Asset provenance, scene briefs and measured payloads are in `manforth-art.md` and the manifest.
3. Configure and audit all four annual prices, signed webhooks, portal, tax/merchant requirements and current launch guard. Then execute all four real Stripe test checkouts and signed-webhook/cancellation journeys before enabling live payments.
4. Publish reviewed Terms/Privacy and set `POLICY_TERMS_URL` / `POLICY_PRIVACY_URL`. These values are missing locally. The footer omits placeholder policy links rather than publishing unreviewed legal text. Add `LANGUAGE_PRODUCT_URL` only after verifying that destination and its separate entitlement.
5. Verify production signup/email verification, eligible trial confirmation, existing paid/expired account journeys, both themes, text zoom and real touch behavior. Preserve existing trial/customer history throughout.

No production-readiness or final-art-approval claim is made from the local build alone.

## User-supplied artwork replacement

The five hero scenes now use the user-supplied Finance, Investments, To-Do, Events and Gym PNG attachments. Updated mobile and desktop derivatives, focal positioning and exact byte measurements are documented in `docs/manforth-art.md`; historical payload numbers above describe the earlier artwork baseline.
