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
