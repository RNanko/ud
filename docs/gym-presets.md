# Gym workout presets

Implemented inside the existing Gym route. Events, other application sections, authentication, navigation shell, and existing user records are not modified by this feature.

## Workflow

Gym → Presets provides 20 ordered strength recipes, six cardio recipes, and three optional easy cardio finishers. Twelve featured routines are shown initially. Users can preview, customize, favorite a personal copy, save, schedule a date, or start immediately using the existing Gym actions. The existing builder remains available for further editing.

Strength recipes select exercises only. New selections start with blank repetitions, weights, rest and timed targets, with one empty logging row. There is no level-based prescription, rep range, target effort or proposed weight increase. Users enter their own quantities; existing personal templates retain their recorded targets. Planned targets and actual results remain separate. Cardio duration remains an explicit editable choice; distance stays unknown until entered. Optional cardio is appended to the same workout, not counted as another workout.

Exercise-only routines can be saved and scheduled without numerical targets. Starting one creates empty actual entries; completing an entry still requires valid recorded results. Estimates remain unknown until users supply the quantities needed to calculate them. Landing-page weights and repetitions are explicitly labeled illustrative user-entered examples, never recommendations.

The active workout also has an optional easy cardio selector. Changing its choice preserves recorded results, skips remaining work from the previous choice, and keeps the original scheduled snapshot. Reapplying the same active choice updates targets without creating duplicate exercise entries.

## Reuse and persistence

Reuses Gym dialogs, buttons, fields, notes disclosures, selectors, motion components, builder, date handling, session editor, authenticated actions, and account-scoped database records. Optional JSON fields preserve old records without a table migration. Templates, scheduled snapshots, and session original plans remain independent; editing a personal copy cannot rewrite prior history. Existing revision checks and mutation IDs prevent duplicate retries.

Domain resolution is in `lib/gym/presets.ts`; exact catalogue identities and compatible alternative groups are in `lib/gym/catalogue.ts`. Recipes are versioned data in `lib/gym/strength-presets.json`. New UI consists of WorkoutPresets, CatalogueGallery, CatalogueIcon and GymSafety. The builder and actual logging fields support per-set planned loads, per-side tracking, warm-up sets and optional effort/control/pain observations. Warm-up sets are excluded from working-set summaries.

Previous weights require a matching exercise variant and load convention, user-entered repetition targets, working-set pattern, recent actual history, and a matching named apparatus for machine loads. Other history is reference-only. Reuse requires an explicit user action; history never fills a new selection automatically. Changing to an alternative clears repetitions, loads, rest, duration and apparatus identity. Historical exercise snapshots and personal routines are preserved.

## Safety and limits

Exercise selections, substitution groups and supplied illustrations are labeled **unreviewed; qualified coach review pending**. A qualified trainer should check technique, apparatus setup, suitability and individual working loads. Injury, pain, health conditions and specialist needs require consultation with a clinician or physiotherapist. Nothing diagnoses injury, estimates recovery, invents calories, or declares a plan medically suitable.

All 714 supplied exercise illustrations and 171 equipment illustrations are browsable separately. The focused library has 63 configured loggable exercise definitions, including the variants required by every preset. Other catalogue movements are browsing-only; users can create a custom exercise with explicit tracking after appropriate review. Equipment illustrations never become completed exercise records. No new Events or weekly arrangement presets were added, per the requested Gym-only scope.

## Assets

Every supplied icon was imported locally from the 128px WebP source variants. All 885 files were checked with Pillow: 128 × 128 pixels and transparent alpha. Total thumbnail payload: **5,757,154 bytes (5.49 MiB)**. Individual files: **2,624–11,068 bytes (2.6–10.8 KiB)**. Larger WebP variants and source PNG masters are excluded. The shared registry records exact identities and sizes; images have fixed dimensions and lazy loading, with a reusable fallback. The gallery paginates 36 thumbnails per page.

Exercise cards, saved workouts, category selectors and custom-exercise previews now use the same WebP artwork set. The 52 old SVG illustrations, their obsolete manifest and generator have been removed. Unsupported outdoor-bike artwork and failed images render no illustration. Legacy records retain their IDs and measurement conventions; generic records may show an equipment illustration instead of asserting a specific movement variant. External source references have been removed from the user interface while trainer and specialist consultation guidance remains.

Regenerate with `node scripts/import-gym-catalogue.mjs` while the supplied source folders and catalogue Markdown remain available. Measurements are recorded in `public/gym/catalogue/manifest.json`.

## Validation

The automated suite covers every icon reference, all 80 strength resolutions (including legacy profile metadata), blank targets and actual entries for every tracking type, cardio segment totals, optional cardio, substitution target clearing, explicit history reuse, snapshot isolation, personal favorites, ownership and idempotent session creation. Existing tests also cover logging completion, calendar boundaries and unrelated application behavior. No fake completed workouts or test records were inserted into the user's account during browser checks.

Executed successfully on October 3, 2026: the full Node test suite (231 passed, zero failed), `tsc --noEmit`, ESLint (zero errors and one existing warning in `app/not-found.tsx` about internal navigation), and the Next production build including all routes. Browser checks verified empty strength weights and repetitions, the preset preview at 390px width without horizontal overflow, and the shared blue-tinted Account field styling including autofill masking and matching 52px password-field heights. Active-cardio persistence and preservation were verified through automated domain tests; browser checks did not write live account records.
