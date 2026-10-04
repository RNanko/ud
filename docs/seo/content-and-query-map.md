# Public content and query map

These are intent hypotheses based on the shipped product, not keyword-volume research. Search demand, difficulty, rankings, traffic, backlink metrics, Search Console coverage and conversions are **Unknown**. No authorized Search Console/analytics data was available.

| Page | User intent hypotheses | Distinct useful content | Working next steps |
| --- | --- | --- | --- |
| `/` | ManForth; ManForth by B1-Way; personal-development planner; planner for tasks, workouts and goals | Six ordinary HTML feature explanations, Events → Gym → Momentum example, interactive demo, annual offer and three shared questions | Feature pages, Help, membership information and existing trial action |
| `/features/workout-planner` | workout planner and training log; weekly workout planning; log weights and cardio | Template/plan/actual distinction; builder → date → per-set log → review; bodyweight/cardio fields; a user-entered plan-versus-actual table; qualified-trainer/suitability limitation | Weekly planning, shared training Help, trial |
| `/features/weekly-planner` | weekly planner with tasks and events; reusable week planner | Dated Events with optional times; To-Do board; event/week presets; plans-only Gym copying; explicit completion; mixed-week component preview | Workout planning, goals, shared Help, trial |
| `/features/goal-tracker` | goal tracker with weekly review; track workout consistency and focus time | User-chosen goal periods; one linked occurrence counted once; logged focus time; Journeys, Recent Wins and Weekly Review; manual money-record limitation | Weekly planning, training, shared Help, trial |
| `/help` | ManForth help; trial and membership questions; training records and privacy support | Existing searchable 12-answer registry, all answer text in initial HTML; footer policies/contact and links to the three feature explanations | Relevant answers, public explanations and existing account destinations |

## Product/copy decisions

- Keep the original H1, “Build the man you choose to be.” The nearby descriptor now explicitly describes a personal-development planner for training, tasks, money and goals.
- Home title: **ManForth — Workout, Task & Goal Planner | B1-Way**. Description: **Plan your week, log workouts, organize spending, and track personal goals with ManForth by B1-Way. Connect your daily actions in one workspace.** These are supplied metadata, not a promise of Google's exact snippet.
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

Keep money/investment explanations on the homepage/Help for now. No thin money pages, exercise-catalogue SEO expansion, scraped comparisons, medical/finance advice farm, invented native release pages or unrelated language-learning keywords.

Future editorial dates should reflect an actual content review. Demand and performance should be revised from real owner-authorized query data, not invented monthly volumes or growth forecasts.
