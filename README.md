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

1. Create a free [Supabase](https://supabase.com) project (free tier covers 2
   active projects, 500MB storage — plenty for this).
2. Open the SQL Editor in your Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql).
3. In the app's Sync tab, paste your project URL and anon public key
   (Project Settings → API in Supabase), then tap Save settings.
4. Share the same URL/key with your group so everyone points at the same project.

Note: the schema uses permissive open policies (no login) — fine for a casual
friend-group app, but don't put anything sensitive in that project.

## Importing your real lineup

The app ships with a placeholder sample lineup so it's usable out of the box.
To load your real one: export your spreadsheet as CSV with columns
`name, stage, day, start, end, genre, description` (day is 1-4, start/end are
`HH:MM` 24h or `H:MM AM/PM`), then use **Import CSV** on the Sync tab. Whoever
imports it can then Push so the rest of the group can Pull it down.
