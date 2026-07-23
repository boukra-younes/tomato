# Nutrition Platform

React + Vite + Supabase full-stack nutrition, body and health tracking app.

## Setup

1. `npm install`
2. Create a Supabase project.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. In Supabase Auth settings, enable Email provider.
5. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_USDA_FDC_API_KEY` (free key from https://fdc.nal.usda.gov/api-key-signup.html)
6. `npm run dev`

## Deploy to Netlify

1. Push repo to GitHub.
2. New site from Git in Netlify, build command `npm run build`, publish dir `dist`.
3. Add the same environment variables in Netlify site settings.
4. Deploy.

## Data sources

- USDA FoodData Central (generic foods)
- Open Food Facts (branded foods, barcodes)
- Local Algerian food library (`src/lib/algerianFoods.js`)
- Compendium of Physical Activities MET values (`src/lib/metDatabase.js`)
- USDA DRIs for micronutrient targets (`src/lib/dri.js`)

## Design

Rebuilt to match the "Deficit Protocol" reference UI exactly: dark theme by default (toggleable to light), Fraunces serif headers, IBM Plex Mono labels/tables, and a top bar showing profile summary, sync code, and unit/theme toggles. Navigation: Home, Food, Plan, Body, Exercise, Health, Progress, Reports, Tools.

The **Plan** tab is the centerpiece — `src/lib/planEngine.js` generates the full day-by-day projection for the entire plan duration: a fixed daily deficit (kept constant) recalculates BMR/TDEE/target from that day's linearly-projected weight, so the target eases down over time exactly like the reference. The day-by-day table groups all days into collapsible weekly rows. Track Progress (sub-tab) logs daily calories/weight against that plan and charts logged-vs-target and logged-vs-projected curves.

## Nutrition data engine

`src/lib/nutritionApi.js` is a multi-source engine, browser-only (fetch + Supabase, no server):

- Sources, searched in order and merged: local databases (Algerian built-in; Japanese/Korean/recipes auto-detected via `import.meta.glob` if you add `japaneseFoods.js`, `koreanFoods.js`, `recipes.js` to `src/lib/`) → Supabase cache (`food_cache` table) → USDA → Open Food Facts → Nutritionix → Edamam → Spoonacular.
- Every source normalizes into one unified food shape (`normalizeFood`) with every nutrient defaulting to 0, never `undefined`.
- `searchFood(query)` runs all sources in parallel via `Promise.allSettled`, dedupes on barcode/ref/normalized name (`mergeFoods`), and ranks results (`sortFoods`). `unifiedFoodSearch` is preserved as a backward-compatible alias.
- Optional sources (Edamam, Spoonacular, Nutritionix) read keys from `import.meta.env` and skip silently if unset — see `.env.example`.
- `lookupBarcode` checks Open Food Facts → Nutritionix in order.
- `scaleNutrients` supports g/kg/mg/oz/lb/ml/l/cup/tbsp/tsp/piece/slice/serving.
- All existing exports (`searchUsdaFoods`, `getUsdaFoodDetail`, `searchOpenFoodFacts`, `lookupBarcode`, `unifiedFoodSearch`, `scaleNutrients`, `searchAlgerianLibrary`) keep their original signatures — this was a drop-in replacement, no other file changed.

### If you already deployed an earlier version of this project

`schema.sql` gained tables (`daily_logs`, `food_cache`, `workout_sessions`, `workout_sets`, etc.) across iterations. If your live Supabase project only has the tables from your first run, you'll see 404s like `daily_logs?select=*... 404 (Not Found)`. Run these in the Supabase SQL Editor, in order — both are idempotent (`create table if not exists`, guarded policy creation) so they're safe even if some of it already exists:

1. `supabase/migration_2.sql` — adds `daily_logs`, `food_cache`.
2. `supabase/migration_3.sql` — adds `workout_sessions`, `workout_sets` for full set-by-set exercise tracking.

## Exercise engine

`src/lib/exerciseDatabase.js` is a self-contained, dependency-free engine that generates ~2,700 exercises from movement-family templates (rather than hand-authoring each one) across strength, cardio, sports, stretching/mobility/yoga, and daily activities, plus a machine-brand catalog. It builds search indexes (by muscle, equipment, category, difficulty, movement pattern, body region) and exposes calorie/workout calculators (`calculateCalories`, `calculateExerciseCalories`, `calculateWorkoutCalories`, `estimateWorkoutTime`) using `Calories = MET × weight(kg) × duration(hours)`.

The **Exercise** page is built entirely on this engine:
- Search + filter (category, muscle, equipment, difficulty) across the full database, with a detail view (instructions, tips, muscles worked, rep/rest recommendations) for every exercise.
- A **workout session builder** — add multiple exercises, log every set (reps + weight for strength, duration/distance/intensity for cardio), see a live estimated-calorie total, then "Finish workout" to save the full set-by-set breakdown to `workout_sessions` / `workout_sets`. A summary row is also mirrored into `exercise_logs` so the Home dashboard and Reports keep working unchanged.
- Logged workouts for the day are listed below, expandable per exercise.

### Google Fit step sync (optional)

`src/lib/googleFit.js` is a browser-only integration using Google Identity Services for the OAuth token (no backend, no client secret) and the Fitness REST API directly via `fetch()`. To enable it:

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application), add your app's origin(s) to Authorized JavaScript origins, and enable the **Fitness API**.
2. Set `VITE_GOOGLE_CLIENT_ID` in `.env`.
3. On the Exercise page, click "Connect Google Fit" (consent popup), then "Sync from Google Fit" to pull that day's step count into `step_logs`.

The access token is held in memory for the browser session only (implicit-style token flow) — there's no persistent server-side refresh, so syncing is a manual "sync now" action per session rather than a background job, consistent with the app's no-backend architecture.

## Responsive design

Fully responsive down to small phones. Below 768px the desktop tab strip is replaced by a fixed bottom **mobile navbar** (`src/components/MobileNav.jsx`) with Home/Food/Plan/Body plus a "More" sheet for Exercise/Health/Progress/Reports/Tools. The header stacks vertically, grids collapse to fewer columns, and wide tables (Plan's day-by-day grid, entry log) scroll horizontally instead of breaking layout.

## Database schema via Prisma

Prisma has been added as the **schema and migration tool** for the Postgres database that Supabase hosts. It does not change how the app talks to the database at runtime.

**How it fits together, briefly:**

- Your React app runs entirely in the browser and keeps using `@supabase/supabase-js` for every query (`supabase.from('food_logs').select(...)`, etc.), exactly as before. Nothing about that changed.
- Prisma Client (the query library) requires Node.js — it cannot run inside a browser bundle, so it was never a candidate to replace `supabase-js` here without also adding a backend server, which would break the "single-page app + Supabase, no backend" architecture this project is built on.
- What Prisma *does* give you: `prisma/schema.prisma` is now a single, readable file describing every table, column, type, and relation. Instead of hand-writing `ALTER TABLE` SQL and a matching numbered migration file (as `migration_2.sql`, `migration_3.sql` were), you edit the model in `schema.prisma` and let Prisma generate and run the migration for you.
- The two systems point at the **same database** — Prisma just connects directly to Postgres (`DATABASE_URL`/`DIRECT_URL`), bypassing Supabase's API layer, purely to run schema changes.

**One-time setup (do this once):**

1. In Supabase Dashboard → Project Settings → Database, copy the connection strings into `.env` as `DATABASE_URL` (pooled, port 6543, with `?pgbouncer=true`) and `DIRECT_URL` (direct, port 5432) — see `.env.example`.
2. Run `npm install` (pulls in `prisma` and `@prisma/client` as dev dependencies).
3. **Baseline** the existing database so Prisma knows your tables already exist and doesn't try to recreate them:
   ```
   npx prisma migrate resolve --applied 0_init
   ```
   This works because the very first migration Prisma would generate from the current `schema.prisma` is treated as already applied — you're telling Prisma "this state already exists in the DB, just start tracking from here." If that command complains the migration doesn't exist yet, first run `npx prisma migrate dev --create-only --name init` to generate the migration folder without applying it, then run the `resolve --applied` command above.

**Every time you want to change the database going forward:**

1. Edit `prisma/schema.prisma` — add a field, add a table, change a type, etc.
2. Run:
   ```
   npm run db:migrate -- --name describe_your_change
   ```
   (e.g. `npm run db:migrate -- --name add_sleep_quality_to_health_logs`)
3. Prisma diffs your schema against the database, writes a new SQL file under `prisma/migrations/<timestamp>_describe_your_change/`, and applies it to Supabase automatically. Review that generated SQL file before committing — it's plain, readable SQL.
4. If the change adds a column your app needs, update the relevant page/store in `src/` to read/write it via `supabase-js` as usual — Prisma only changed the schema, not the query code.
5. For production/CI (no interactive prompts), use `npm run db:deploy` instead of `db:migrate` — it applies pending migrations only, without trying to create new ones.

**Other useful commands:**

- `npm run db:studio` — opens Prisma Studio, a local GUI to browse/edit table rows directly (handy for debugging, faster than the Supabase table editor for some tasks).
- `npm run db:pull` — introspects the live database and rewrites `schema.prisma` to match it exactly. Useful if someone changes a table by hand in the Supabase SQL editor and you want `schema.prisma` to catch up.
- `npm run db:status` — shows which migrations have been applied vs. pending.

**Important:** `supabase/schema.sql` and the `migration_2.sql`/`migration_3.sql` files remain as-is — they're the historical record of how the database reached its current state, and `schema.sql` is still the fastest path for bootstrapping a brand-new Supabase project from zero. From here forward, though, make schema changes through `schema.prisma` + `prisma migrate dev` rather than hand-writing new numbered `.sql` files, so there's one consistent, versioned history.

## PWA (installable, works offline)

The app is a fully configured Progressive Web App via `vite-plugin-pwa`, generating a service worker at build time (`generateSW` strategy — nothing to hand-write).

- **App shell precaching**: every built JS/CSS/HTML/icon file is precached on first load, so the app boots and navigates offline after that.
- **Runtime caching**: USDA and Open Food Facts responses are cached (`CacheFirst`, 30 days) so food search stays usable offline for anything already looked up; Google Fonts are cached indefinitely; Supabase data reads use `NetworkFirst` (fresh when online, falls back to the last-seen response when offline instead of erroring).
- **Icons**: real PNG icon set in `public/` (192/512, plus maskable variants for Android's adaptive-icon safe zone, an Apple touch icon, and SVG/ICO favicons) — this was previously referencing files that didn't exist, which silently breaks installability; that's fixed.
- **Install button**: `src/components/InstallButton.jsx` appears in the header only when the app is not already installed. On Chromium/Android it captures the native `beforeinstallprompt` event and triggers the real install prompt; on iOS Safari (which has no such API) it shows brief "Share → Add to Home Screen" instructions instead. It disappears automatically once installed (`appinstalled` event / standalone display-mode detection).
- **Safe updates**: `registerType: 'prompt'` + `src/components/PwaUpdatePrompt.jsx` — a new version never silently reloads the app out from under you. It shows a small "Update available — Refresh now / Later" toast, and a one-time "Ready to work offline" toast the first time the app finishes precaching.

**Testing it locally:** the service worker only builds in production mode — `npm run dev` does not register one. Use:
```
npm run build
npm run preview
```
then open the printed `http://localhost:...` URL. Installability (and the install button) requires either `localhost` or a real HTTPS deployment — browsers block install prompts on plain HTTP.

**If you change the icons:** replace the PNGs in `public/` (keep the same filenames/sizes referenced in `vite.config.js`'s `manifest.icons` and `index.html`'s `<link rel="icon">`/`apple-touch-icon"` tags), then rebuild.

## Auth & security

Supabase Auth (email/password) with Row Level Security on every table scoped to `auth.uid()`. Password changes go through `supabase.auth.updateUser`.

## Deficit Protocol adaptive engine

`src/lib/adaptiveEngine.js` implements the full adaptive calorie/weight system:

- BMR (Mifflin-St Jeor, auto-switches to Katch-McArdle when body fat % is known) and TDEE.
- Adaptive TDEE: blends calculated TDEE with a measured value derived from real trend-weight change vs. logged calories over a trailing 21-day window, confidence-weighted up to 28 days of data.
- 7-day moving average + exponential-smoothed trend weight, with outlier flagging (>3 std dev).
- Plateau detection (<0.1% bodyweight/week slope over 14 days).
- Daily calorie target with goal-type branching, safe-minimum clamping, and color-state (green/orange/blue/red) semantics.
- Macro engine: protein by g/kg (scales with deficit size), fat floor, carbohydrate as remainder with a 50g safety floor.
- Weekly rate, projected completion date, progress %, and auto-generated milestones.
- Adherence tracking, logging streaks, and calorie-target history (snapshotted daily to `calorie_target_history`).

`src/context/useDeficitStore.js` wires this engine to Supabase data and recomputes on every load of Dashboard or Body. Notifications (plateau, milestones, goal reached) surface via the Nav badge and Dashboard banner.
