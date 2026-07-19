# Lolla Planner

A local-first festival planner: rate bands, build a personal schedule, and see it
laid out on a visual grid across days and stages. Built to run entirely offline
on a phone — an online/offline toggle controls whether it talks to the network
at all.

## How it works

- **All data lives on your device** (IndexedDB via Dexie). The app never makes a
  network request while the Sync tab's toggle is off.
- **Ratings and schedule are per-person**, identified by a display name you pick
  on first launch (no accounts, no passwords) — so a shared group's data stays
  separated but syncs to the same backend.
- **Groups are joined by a short code.** Leave the code field blank on first
  launch to start a new group (you'll get a code to share); enter a friend's
  code to join theirs instead. You can view/copy your current code or switch
  to a different group anytime from the Sync tab — switching doesn't delete
  anything, your old group's data is just hidden until you switch back.
- **The group schedule optimizer** builds one shared itinerary from everyone's
  ratings — it picks the set of bands that maximizes total group rating while
  only chaining two picks back to back if there's enough time to actually walk
  between their stages (Schedule tab → "Group Pick"). It's a plain algorithm
  (weighted interval scheduling with walk-time constraints), not an LLM call,
  so it runs instantly and fully offline. "Adopt into my schedule" copies its
  picks into your personal schedule as a one-time, additive action — it never
  overwrites anything you've picked yourself, and regenerating the group
  schedule later doesn't retroactively change schedules people already adopted.
- **Sync** is a small [Supabase](https://supabase.com) project (Postgres + REST,
  free tier). Flip the toggle online and your ratings/schedule/lineup sync with
  the group automatically in the background (debounced push on every local
  change, plus a periodic pull); flip it off and everything stays local until
  you flip it back on.
- **Supabase credentials are baked in at build time**, not entered by end users
  — see "Setting up shared sync" below. Everyone in your group just sees a
  toggle, never a URL or API key.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

Without `.env.local`, the app still runs fine — the Sync tab just shows the
toggle as disabled with a "not configured" note.

## Building & installing on your phone

1. Deploy `npm run build`'s `dist/` folder somewhere reachable (Vercel, Netlify,
   GitHub Pages, etc. — `vercel.json` in this repo is already configured for a
   zero-config Vercel import), or run `npm run preview` on a laptop and open it
   from your phone over the same Wi-Fi to test.
2. Open the URL on your phone once, with signal.
3. Add it to your home screen (Safari: Share → Add to Home Screen; Chrome:
   menu → Install app). It now runs like a native app, fully offline.

## Setting up shared sync

You can use a fresh Supabase project, or share an existing one you already have
running other apps — Lolla's tables live in their own `lolla` Postgres schema
(not `public`), so there's no risk of table-name collisions with anything else
in that project.

1. Open the SQL Editor in your Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql).
   This creates the `lolla` schema and its three tables.
2. **Required extra step for a non-public schema**: in the dashboard, go to
   Integrations → Data API → Settings → Exposed schemas, and add `lolla` to
   the list (keep `public` there too if other apps need it). Postgres schemas
   aren't visible to the REST API by default — skip this and sync will
   silently fail. (Supabase reorganizes this dashboard periodically; if it's
   not there, search Project Settings for "Exposed schemas" or "Data API".)
3. Grab the project's URL and key from Settings → API Keys. Use the
   **Publishable key** (`sb_publishable_...`) if your project has one, or the
   legacy **anon public** key (`eyJ...`) if it doesn't — either works, they're
   the same RLS-protected, public-safe role under different names.
4. Set them as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — either in
   `.env.local` for local dev, or as Environment Variables in your Vercel/Netlify
   project settings for the deployed build. These are compiled into the app;
   your group never sees or types them, they just get a toggle.

Note: the schema uses permissive open policies (no login) — fine for a casual
friend-group app, but don't put anything sensitive in these three tables.

## Importing your real lineup

The app ships with a placeholder sample lineup so it's usable out of the box.
To load your real one: export your spreadsheet as CSV with columns
`name, stage, day, start, end, genre, description` (day is 1-4, start/end are
`HH:MM` 24h or `H:MM AM/PM`), then use **Import CSV** on the Sync tab. If sync
is online, the import pushes automatically so the rest of the group picks it
up on their next pull.

## Importing real stage-to-stage walking times

The group schedule optimizer needs to know how long it takes to walk between
stages, or it can't tell a feasible back-to-back pick from an impossible one.
Until you provide real numbers it assumes a flat 12-minute walk between any
two different stages. Import a CSV with columns `stage_a, stage_b, minutes`
(one row per pair, order doesn't matter) via the Sync tab.
