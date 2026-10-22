# Mountain journey hero

## Homepage integration — 2026-10-18

The approved mountain design now renders on `/` through the shared `JourneyHero`
component. `/journey-preview` uses the same component and remains excluded from
indexing. The feature row is raised 20px, contains Finance, Investments, To-Do,
Events and Gym, and sits on the artwork. Pricing is informational, not a link.
The main CTA uses the existing session-aware `MainAction`.

The old carousel, interactive sample boards and duplicate feature examples no
longer render on the homepage. A short workflow replaces the sample area and
preserves the `#how-it-works` destination. Existing pricing, FAQ, footer and SEO
metadata remain. Both viewport layouts use `desktop-transparent.webp` and the
same star/road animation; mobile crops the shared coordinate space.

Integration verification: targeted ESLint, TypeScript, 25 landing/SEO tests and
the production build passed. Generated homepage HTML has one h1, all four
navigation anchors, five hero feature links without Notes, and no old sample
controls or preview label. Live visual rechecking was blocked by the browser
URL policy during this integration turn; earlier preview screenshots are not
evidence of the integrated homepage layout.

The notes below describe the original preview experiment, not the current
homepage composition.

Open `http://localhost:3000/journey-preview`. Run `npm run dev`, or
`node node_modules/next/dist/bin/next dev --webpack` if the local Turbopack
worker fails. The route is marked `noindex, nofollow` and is not in the sitemap.
No existing homepage, global style, auth, persistence or account logic was edited.

## Files and boundaries

- `app/(root)/journey-preview/page.tsx`: isolated server-rendered shell, existing Brand/Button and real registration CTA destination.
- `app/components/landing/journey/`: small client island, typed configuration, pure placement helper, scene, decorative sky/route, palette/cards/checkpoints and scoped CSS.
- `public/journey-preview/`: optimized artwork and source/crop manifest.
- `scripts/create-journey-preview-assets.mjs`: reproducible crops; pass the directory containing the original PNGs.
- `tests/journey-preview.test.mjs`: immutable placement, occupied-target protection and repositioning tests.

## Artwork

Latest sky treatment: `desktop-transparent-source.png` and
`mobile-transparent-source.png` were created with built-in image generation,
using the cleaned plates as edit targets. Prompt: remove only clear night sky
and baked stars to real alpha; retain clouds with soft edges, mountains, road,
flag, moon/planet, colors and full composition. These are AI-edited derivatives,
not pixel-exact masks. Both source files have alpha values from 0 to 255.
Active assets are now `desktop-transparent.webp` and `mobile-transparent.webp`;
the prior opaque assets are retained for comparison. The same asset script
rebuilds them with alpha preserved. Stars render behind the foreground over a
blue radial gradient. Two identical SVG tiles move right with linear timing and
seamless wrapping, with 220/280/360-second periods. Pointer parallax is removed
so pointer movement cannot reverse the stars. Pause/reduced motion still apply.

All four references were inspected. The original crop-only approach left a
visible image boundary and concealed the left-hand scenery. The revised design
uses AI-cleaned derivatives of references 01 and 02, made with the built-in
image-generation tool. UI/text removal reconstructed the previously hidden
areas, so these derivatives are not pixel-identical extractions. Originals remain
untouched, and their comparison crops remain available.

Saved editable source plates: `public/journey-preview/desktop-clean-source.png`
and `mobile-clean-source.png`. Active optimized outputs are `desktop-clean.webp`
(1672 × 941), `mobile-clean.webp` (crop 180,350,620,956) and `mobile-sky.webp`
(crop 0,0,941,350). The asset script rebuilds these from the saved plates;
`artwork.json` records hashes and crops.

Editing prompt intent: remove only all text, navigation, buttons, statistics,
feature cards, checkpoint UI and tray; reconstruct those areas with continuous
existing scenery; preserve mountain silhouette, summit/flag, cyan winding road,
lake/town, sky, clouds, lighting, composition and aspect ratio; no new landscape,
crop or zoom. The desktop and mobile references were edited separately.

The desktop scenery spans the viewport behind the header, copy and glass tray,
with no left mask. All feature cards are real HTML controls with independent
hover/focus and floating motion. Mountain and sky remain one raster layer; only
stars have pointer parallax. Tablet/mobile use the vertical composition and a
separate sky crop behind the headline. SVG and checkpoints use matching scene
coordinates; the mobile highlight was retraced for reconstructed road areas.

## Interactions

Each scenic feature card now opens the app's accessible Popover component with
feature details and an explicit Place on path action. All four desktop cards were
opened/closed in-browser; mobile detail-to-Ascent placement was verified. Below
601px, the header/introduction are hidden so the mountain starts at the top.
The palette remains below the scene. Stars use seeded positions and staggered
4–10 second brightness cycles in clear sky regions beside the summit, plus slow
layer drift. The latest transparent-sky treatment above supersedes the opaque sky.

Mouse drag or select a card then choose a checkpoint. Occupied targets explicitly
reject replacement. Inspect a placed card to move/remove it; Escape cancels.
Reset clears local state. Refresh clears it too. No storage, server actions,
account writes or requests are introduced by the demo interaction code.

Stars drift in three lightweight SVG layers. Only these overlays have pointer
parallax; text and mountain stay fixed. A short highlight follows the painted road
upward. Placement triggers +1 and an additional brief upward highlight. Pause
motion invokes a static reduced-motion mode. OS reduced motion is also respected.

## Verification — 14 October 2026

Revised composition: continuous full-width scenery, layered header/tray and real
floating scene cards. Targeted ESLint, TypeScript and all three state tests pass.
Browser checks repeated at 320/390/768/1280/1440/1920 viewport settings: no
horizontal page overflow; mobile select-then-place and desktop mouse drag into
Ridge work; Pause motion reports zero animated CSS elements. No runtime errors
were observed (only the expected development Fast Refresh reload warning).
Homepage entry, hero and landing CSS hashes still match their pre-task values.
The earlier phase checks below describe the initial implementation.

- Phase 0: inspected four originals, existing landing components/tokens, packages and assets.
- Phase 1: static page tested at 390/1440; no image distortion; real CTA destination.
- Phase 2: six palette labels, transparent painted-card hotspots and checkpoint alignment checked.
- Phases 3–4: three star layers/27 points, timings and SVG coordinate systems inspected in-browser; no second thick road.
- Phase 5: real mouse drop, invalid drop, keyboard placement, occupied-target rejection, Escape, moving/reset and mobile click-to-place verified. +1/arrival animation creation checked.
- Phase 6: 320/390/768/1280/1440 viewport targets checked (browser rounds two widths by one pixel). No page overflow, proportional scenes, visible controls at least approximately 44px. Static mode reports zero active CSS animations and supports placement.
- Phase 7: targeted lint, TypeScript, three state tests and production build passed. Homepage entry, hero and landing stylesheet SHA-256 hashes match the pre-task values; original homepage still renders separately.

The local Turbopack worker crashed while spawning its CSS worker; Webpack dev
mode was used for the final browser checks. No project configuration was changed.
Physical touch hardware, OS preference switching, screen-reader audio and
midrange-device frame rates were not tested. The static-mode path and keyboard
alternative were tested; these are not substitutes for those hardware checks.

Before any production replacement: review the AI-cleaned scenery, review the crop
and road alignment on real devices, verify touch/screen-reader use and profile
animation on a midrange phone. This preview does not authorize a replacement.
