# Lolla Planner

A local-first festival planner: rate bands, build a personal schedule, and see it
laid out on a visual grid across days and stages. Built to run entirely offline
on a phone — an online/offline toggle controls whether it talks to the network
at all.

## How it works

- **All data lives on your device** (IndexedDB via Dexie). The app never makes a
  network request while the Sync tab's toggle is off.
- **Accounts are real** (username + password via Supabase Auth), so signing in
  on a different device picks up the same identity — ratings/schedule are
  attributed to your account, not just whatever name you happened to type.
  Signing up or logging in on a new device needs network access (it's a real
  server-side password check); once logged in, the session is cached locally
  and normal use — rating, scheduling, viewing — stays fully offline just like
  everything else, until you explicitly log out.
- **Groups are joined by a short code**, entered at sign-up. Leave it blank to
  start a new group (you'll get a code to share); enter a friend's code to
  join theirs instead. View/copy your current code or switch to a different
  group anytime from the Sync tab — switching doesn't delete anything, your
  old group's data is just hidden until you switch back.
- **Rating a band happens on its own detail screen**, not from the list — tap
  a band tile to open it. Two independent ratings, each 1-5 with notes:
  **pre-festival** ("how badly do you want to see this," feeds the group
  schedule optimizer) and **during the festival** (how the actual set was —
  a personal record, never affects scheduling). The list itself stays a fast
  scan: name, time, stage, and a small read-only ★ indicator showing your
  pre-festival rating once you've set one.
- **The Schedule tab has two halves.** "Group Schedule" is computed, not
  editable — it picks the set of bands that maximizes total group rating from
  everyone's pre-festival ratings. Exact start/end times aren't a hard
  requirement — arriving up to 15 minutes late or leaving up to 15 minutes
  early is fine (a flat cap, not a fraction of the set's length, so a
  2-hour headliner set doesn't get an hour of slack) — so two picks chain if
  there's a walk window that fits within that. Walking distance only
  matters as a tie-break beyond that — given two schedules with the same
  total rating, it picks whichever crosses the park less. Plain algorithm
  (weighted interval scheduling, generalized with a minimum-attendance
  window and a walk-distance tie-break), not an LLM call, and there's no
  generate button — it's a live view that recomputes instantly whenever a
  rating changes, whether that's you rating a band or a teammate's rating
  arriving on the next sync. Runs fully offline; it just won't reflect
  anyone else's ratings until you're
  back online.
  "Individual Schedule" always shows the group schedule as a base layer (gold)
  plus whatever you've personally added on top (blue) — no separate step
  needed to see the group's plan alongside your own. Rating a band "I cannot
  miss this band" (5) auto-adds it to your personal schedule the moment you
  rate it, unless the group schedule already has it covered — you shouldn't
  have to remember to also go tap "Add to schedule" for your own must-sees.
  You can remove anything you've personally added (gold group picks aren't
  yours to remove — that's what the Group Schedule tab is for); a member
  switcher lets you view — read-only — anyone else in your group's individual
  schedule the same way. Both halves, and both other members' schedules,
  support List and Grid views.
- **Sync** is a small [Supabase](https://supabase.com) project (Postgres + REST,
  free tier). Flip the toggle online and your ratings/schedule/lineup sync with
  the group — a debounced push after every local change, plus a pull whenever
  you navigate between tabs (Bands/Schedule/Sync/Admin) or first load the app.
  There's no background polling, so the app never refreshes out from under you
  mid-page; switch tabs (or pull to reload the page) to pick up anyone else's
  changes. Flip the toggle off and everything stays local until you flip it
  back on.
- **Supabase credentials are baked in at build time**, not entered by end users
  — see "Setting up shared sync" below. Everyone in your group just sees a
  toggle, never a URL or API key.
- **One admin per project manages the shared data**, in its own Admin tab that
  only the admin account sees in the bottom nav at all — everyone else's nav
  just has Bands/Schedule/Sync. That tab is where the lineup, stage
  distances, and bulk ratings CSV imports live; see "Making yourself the
  admin" below for how to designate that account. Everyone else can still
  rate bands, build their schedule, and view the group's — this only affects
  who can import files. Enforced on the server (Postgres row-level security),
  not just hidden in the UI.

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
   This creates the `lolla` schema and its tables.
2. **Required**: in the dashboard, go to Integrations → Data API → Settings →
   Exposed schemas, and add `lolla` to the list (keep `public` there too if
   other apps need it). Postgres schemas aren't visible to the REST API by
   default — skip this and sync will silently fail. (Supabase reorganizes this
   dashboard periodically; if it's not there, search Project Settings for
   "Exposed schemas" or "Data API".)
3. **Required**: go to Authentication → Providers → Email, and turn **off**
   "Confirm email." The app signs people up with a synthetic address
   (`username@lolla.internal`) since there's no real email step — nobody can
   click a confirmation link that goes to an inbox that doesn't exist, so
   leaving this on means every sign-up gets stuck unconfirmed and can never log in.
4. Grab the project's URL and key from Settings → API Keys. Use the
   **Publishable key** (`sb_publishable_...`) if your project has one, or the
   legacy **anon public** key (`eyJ...`) if it doesn't — either works, they're
   the same public-safe role under different names.
5. Set them as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — either in
   `.env.local` for local dev, or as Environment Variables in your Vercel/Netlify
   project settings for the deployed build. These are compiled into the app;
   your group never sees or types them, they just sign up with a username/password.

Note: every table requires a logged-in account (RLS checks `auth.role() =
'authenticated'`), but group_code itself is still just an application-level
partition — any account in this project can read/write any group's rows.
Fine for a casual friend-group app; don't put anything sensitive here.

## Making yourself the admin

The Admin tab (lineup, stage distances, bulk ratings imports) only shows up in
the bottom nav for the account marked admin — everyone else doesn't see it at
all. There's no in-app "make admin" button — admin status lives in Supabase
Auth's `app_metadata`, which (unlike
`user_metadata`, which the app itself writes for things like your display
name) can *only* be set from the Supabase SQL editor or a service-role key,
never by a signed-in user. That's what makes it safe to trust for gating
writes: any user could otherwise just call `supabase.auth.updateUser()` from
the browser console and grant themselves whatever role they want.

1. Sign up for your account in the app first, if you haven't already.
2. In the Supabase SQL editor, run (swap in your username):
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
   where email = 'yourusername@lolla.internal';
   ```
3. **Log out and back in** in the app. The admin flag is a claim baked into
   your session token at login/refresh time, so it won't take effect until
   your session picks up a fresh one.

To revoke admin from an account, run the same update with `'{"role": null}'`
(or any non-`"admin"` value) instead.

## Importing your real lineup

*Admin only* — lives in the Admin tab, which only shows up in the bottom nav
for the admin account.

The app ships with no lineup at all — Bands/Schedule show an empty state until
the admin imports one, so there's never any placeholder data that could get
mistaken for (or synced alongside) the real thing. To load it: export your
spreadsheet as CSV with columns `name, stage, day, start, end, genre,
description` (day is 1-4, start/end are `HH:MM` 24h or `H:MM AM/PM`), then use
**Import CSV** on the Admin tab. If sync is online, the import pushes
automatically (as a full replace, not merged with whatever was there before)
so the rest of the group picks it up on their next pull.

## Importing real stage-to-stage walking times

*Admin only* — Admin tab.

The group schedule optimizer uses this to break ties between otherwise
equally-rated schedules — it doesn't gate which picks can chain together (see
above), just which of several equally-good options crosses the park least.
Until you provide real numbers it assumes a flat 12-minute walk between any
two different stages. Import a CSV with columns `stage_a, stage_b, minutes`
(one row per pair, order doesn't matter) via the Admin tab.

## Bulk-importing pre-festival ratings

*Admin only* — Admin tab. Everyone else can still rate bands themselves one at
a time from each band's detail screen; this is specifically for writing
ratings in bulk under someone else's name.

If your group already collected pre-festival ratings somewhere else (a
spreadsheet, a poll), you can load them in one shot instead of re-rating every
band by hand in the app. Import your lineup first, then use **Import CSV**
under "Import pre-festival ratings" on the Admin tab with columns `band, user,
pre_rating, pre_notes` (notes optional) — one row per person per band. Bands
are matched to the current lineup by name (case-insensitive), so the name in
the CSV has to match exactly; unmatched rows are skipped and listed after
import. `user` is just a free-text name, the same identity system ratings
always use — the person doesn't need an account yet for their historical
ratings to import; they only need to sign up using that same name later if
they want their own device to pick up the same identity going forward.
