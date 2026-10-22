# Public content and query map

Updated 2026-10-11. These are intent hypotheses based on the app's implemented features, not keyword-volume research. Search demand, difficulty, rankings, traffic, backlink metrics and conversions remain **Unknown**. Search Console confirmed the homepage indexed and the original five-page sitemap successful on 2026-10-11; the four new feature URLs below still require deployment before Google can discover them.

| Page | User intent hypotheses | Distinct useful content | Working next steps |
| --- | --- | --- | --- |
| `/` | ManForth; notes app; money tracker; calendar; to-do lists; gym/activity tracker | Seven HTML feature explanations visible on desktop and mobile, Events → Gym → Momentum example, interactive demo, annual offer and shared questions | All seven feature pages, Help, membership and trial |
| `/features/workout-planner` | gym tracker; activity tracker; workout planner and training log; log weights and cardio | Template/plan/actual distinction; builder → date → per-set log → review; bodyweight/cardio fields; a user-entered plan-versus-actual table | Weekly planning, shared training Help, trial |
| `/features/weekly-planner` | calendar and event planner; check upcoming events; reusable weekly planner | Dated Events with optional times; event/week presets; explicit completion; linked Gym records and mixed-week preview | Workout planning, goals, shared Help, trial |
| `/features/goal-tracker` | goal tracker with weekly review; track workout consistency and focus time | User-chosen goal periods; one linked occurrence counted once; logged focus time; Journeys, Recent Wins and Weekly Review; manual money-record limitation | Weekly planning, training, shared Help, trial |
| `/features/notes` | notes app with drawing; checklists and bullet lists; pinned notes | Mixed text/list/drawing blocks; mouse/finger sketching; pinning, card ordering, editing and save state; weekend-plan example | To-Do, shared Help, trial |
| `/features/money-tracker` | money tracker; expense tracker; income and spending tracker | Amount-to-category workflow; currencies; chart types and filters; history corrections/export; concrete purchase example | Investments, shared currency Help, trial |
| `/features/to-do` | to-do list app; Kanban task board; daily task organizer | Capture, reorder and move tasks through three stages; keyboard support; clear distinction from notes and dated events | Calendar, shared Help, trial |
| `/features/investment-tracker` | stock portfolio tracker; ETF tracker; crypto portfolio tracker | Manual positions, cost/current-value comparison, USD, charts and active/archived history; illustrative unrealized profit calculation | Money tracker, shared currency Help, trial |
| `/help` | ManForth help; trial and membership questions; training records and privacy support | Searchable 12-answer registry in initial HTML; all seven modules named in the shared product answer; links to every feature explanation | Relevant answers, public explanations and existing account destinations |

## Product/copy decisions

- Keep the original H1, “Build the man you choose to be.” The nearby descriptor names notes, money tracking, calendar, to-do lists, workouts, investments and goals.
- Home title: **ManForth — Notes, Money Tracker & Daily Planner**. Description: **Keep notes and sketches, track money and investments, plan calendar events and to-do lists, and log gym workouts and activity with ManForth by B1-Way.** These are supplied metadata, not a promise of Google's exact snippet. Each feature has its own title, description, canonical, social metadata and public explanation. Homepage WebApplication markup lists all seven modules.
- Public feature pages use readable server-rendered component examples with explicit illustrative labels, not private screenshots. Sample sets/loads are user-entered illustrations, not app recommendations. New users receive no fabricated history.
- Shared answers come from `lib/help/content.ts` through the existing `QuestionAnswer`. No separate FAQ registry or answer-per-URL expansion.
- Preserve expenses/revenue and historical currency meaning; investments are USD records, not brokerage/guaranteed returns. Manual Momentum contributions are not automatic Finance/Investment goal linking.
- Only internal app notifications are described. Released iOS/Android apps, native step sensing, external email/push reminders, medical guidance and health scores are not advertised.
- The support contact remains `support-mf@b1-way.pl` from current brand/configuration. No operator identity, expert author, testimonial or review date was manufactured.
- Public pricing text is derived from `annualPrices` / `billingCurrencies`: 40 PLN, 10 GBP, 10 USD, 10 EUR per year. PL/GB/US defaults and EUR fallback are described. Existing-subscription currency and billing logic remain unchanged. A trial is not a zero-priced annual subscription.

## Concise future content backlog

Prioritize owner-reviewed product-use explanations, only when each warrants a substantial page:

1. Planning a flexible week and reusing presets without carrying completion status forward.
2. Logging actual strength sets, unknown cardio distance and display-unit conventions.
3. Understanding goal periods, linked occurrences and a useful Weekly Review.
4. Reviewing recorded focus time without presenting it as proof of mastery.
5. Preserving currency meaning in finance history; distinguishing manual contributions from investment returns.

The money and investment pages explain specific product workflows, examples and limitations. Position history is explicitly distinct from a BUY/SELL ledger or realized profit. No unsupported “best app” rankings, copied comparisons, fabricated ratings, keyword lists or hidden text were added. Existing calendar/gym URLs cover closely related terms without duplicate pages.

Future editorial dates should reflect an actual content review. Demand and performance should be revised from real owner-authorized query data, not invented monthly volumes or growth forecasts.
