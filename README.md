# Lolla Planner

A local-first festival planner: rate bands, build a personal schedule, and see it
laid out on a visual grid across days and stages. Built to run entirely offline
on a phone — it only touches the network when you explicitly tap Push or Pull
to sync with your group.

## How it works

- **All data lives on your device** (IndexedDB via Dexie). The app never makes a
  network request except when you tap Push/Pull on the Sync tab.
- **Ratings and schedule are per-person**, identified by a display name you pick
  on first launch (no accounts, no passwords) — so a shared group's data stays
  separated but syncs to the same backend.
- **Sync** is a small [Supabase](https://supabase.com) project (Postgres + REST,
  free tier). One person imports/pushes the real lineup, everyone else pulls it.

## Local development

```bash
npm install
npm run dev
```

## Building & installing on your phone

1. Deploy `npm run build`'s `dist/` folder somewhere reachable (Vercel, Netlify,
   GitHub Pages, etc.), or run `npm run preview` on a laptop and open it from
   your phone over the same Wi-Fi to test.
2. Open the URL on your phone once, with signal.
3. Add it to your home screen (Safari: Share → Add to Home Screen; Chrome:
   menu → Install app). It now runs like a native app, fully offline.

## Setting up shared sync (optional but recommended)

You can use a fresh Supabase project, or share an existing one you already have
running other apps — Lolla's tables live in their own `lolla` Postgres schema
(not `public`), so there's no risk of table-name collisions with anything else
in that project.

1. Open the SQL Editor in your Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql).
   This creates the `lolla` schema and its three tables.
2. **Required extra step for a non-public schema**: in the dashboard, go to
   Project Settings → API → Exposed schemas, and add `lolla` to the
   comma-separated list (keep `public` in there too if other apps need it).
   Postgres schemas aren't visible to the REST API by default — skip this and
   the app's Push/Pull will fail with a "not found" error.
3. In the app's Sync tab, paste your project URL and anon public key
   (Project Settings → API in Supabase), then tap Save settings.
4. Share the same URL/key with your group so everyone points at the same project.

Note: the schema uses permissive open policies (no login) — fine for a casual
friend-group app, but don't put anything sensitive in these three tables.

## Importing your real lineup

The app ships with a placeholder sample lineup so it's usable out of the box.
To load your real one: export your spreadsheet as CSV with columns
`name, stage, day, start, end, genre, description` (day is 1-4, start/end are
`HH:MM` 24h or `H:MM AM/PM`), then use **Import CSV** on the Sync tab. Whoever
imports it can then Push so the rest of the group can Pull it down.
