-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
--
-- Everything lives in its own "lolla" schema rather than "public" so it's clearly
-- separated from any other apps sharing this project (visible as its own group in
-- Table Editor, zero naming collisions).
--
-- After running this, a few manual steps are required:
--
-- 1. Go to Integrations > Data API > Settings > Exposed schemas, and add "lolla"
--    to the list (comma-separated, alongside "public"). Postgres schemas aren't
--    exposed to the REST API by default, so skipping this means the app can't
--    reach these tables at all.
--
-- 2. Go to Authentication > Providers > Email, and turn OFF "Confirm email".
--    The app signs people up with a synthetic address (username@lolla.internal)
--    since there's no real email collection step — nobody can click a
--    confirmation link that goes to an inbox that doesn't exist, so leaving
--    this on means every sign-up gets permanently stuck unconfirmed.
--
-- 3. Make yourself the admin so the lineup/ratings import CSVs are usable —
--    see "Making yourself the admin" in the README for the one-line SQL and
--    why it has to be run this way instead of from the app.
--
-- Upgrading from an earlier version of this file, where a table's *columns*
-- changed (not just its policies): policies changed from public (anyone with
-- the anon key) to requiring a logged-in account, "ratings"/"schedule" gained
-- a group_code column with a new primary key, and "ratings"'s single
-- rating/notes pair was replaced with separate pre_rating/pre_notes (feeds
-- the group schedule optimizer) and during_rating/during_notes
-- (performance-quality record, never feeds the optimizer) columns. Since
-- `create table if not exists` won't alter an existing table, if you're
-- upgrading across one of those changes specifically, drop the schema first:
-- run `drop schema if exists lolla cascade;` then this whole file again. This
-- deletes any existing rows in these tables — fine for a pre-launch app, but
-- note that every device with local ratings will automatically re-push them
-- next time it's online (sync always sends the full local ratings table, not
-- just deltas), so no manual re-entry needed once everyone's phone reconnects.
--
-- Policy-only changes (like the admin gating below) don't need any of that —
-- every `create policy` here is preceded by a matching `drop policy if
-- exists`, so just re-running this whole file against your existing project
-- picks up the new rules in place, with all your data untouched.
--
-- Note on groups: "bands" and "stage_distances" are global (one shared festival
-- lineup/map for everyone in this project). "ratings" and "schedule" are scoped
-- by group_code. Access control is now real (every request must come from a
-- logged-in Supabase Auth user), but group_code itself is still just an
-- application-level partition, not a security boundary — any logged-in
-- account in this project can read/write any group's rows. Fine for a casual
-- friend-group app; don't put anything sensitive here.
--
-- No group_schedule table: the group schedule is computed locally on every
-- device from ratings + stage_distances (both of which do sync), so there's
-- nothing separate to store or sync for it. If you ran an older version of
-- this file, a lolla.group_schedule table may still exist in your project —
-- the app no longer reads or writes it, so it's safe to ignore or drop
-- (`drop table if exists lolla.group_schedule;`).
--
-- Admin gating: "bands" and "stage_distances" (the lineup + walking-distance
-- CSV imports) can now only be written by an account with app_metadata
-- {"role": "admin"} — see "Making yourself the admin" in the README. Everyone
-- can still read them. app_metadata is never client-writable (only via SQL
-- editor or the service role), unlike user_metadata, so it's safe to trust in
-- a policy. "ratings" now also requires either owning the row (user_name
-- matches your own account's first_name) or being admin, so a non-admin can
-- still rate bands themselves but can't bulk-write ratings under someone
-- else's name via the ratings CSV import.

create schema if not exists lolla;

create table if not exists lolla.bands (
  id text primary key,
  name text not null,
  stage text not null,
  day int not null,
  start_minutes int not null,
  end_minutes int not null,
  genre text not null,
  description text not null default ''
);

create table if not exists lolla.stage_distances (
  stage_a text not null,
  stage_b text not null,
  minutes int not null,
  primary key (stage_a, stage_b)
);

create table if not exists lolla.ratings (
  group_code text not null,
  band_id text not null,
  user_name text not null,
  pre_rating int not null default 0,
  pre_notes text not null default '',
  during_rating int not null default 0,
  during_notes text not null default '',
  updated_at timestamptz not null,
  primary key (group_code, band_id, user_name)
);

create table if not exists lolla.schedule (
  group_code text not null,
  band_id text not null,
  user_name text not null,
  added_at timestamptz not null,
  removed boolean not null default false,
  primary key (group_code, band_id, user_name)
);

alter table lolla.bands enable row level security;
alter table lolla.stage_distances enable row level security;
alter table lolla.ratings enable row level security;
alter table lolla.schedule enable row level security;

drop policy if exists "authenticated read bands" on lolla.bands;
drop policy if exists "authenticated write bands" on lolla.bands;
drop policy if exists "admin write bands" on lolla.bands;
drop policy if exists "authenticated update bands" on lolla.bands;
drop policy if exists "admin update bands" on lolla.bands;
create policy "authenticated read bands" on lolla.bands for select using (auth.role() = 'authenticated');
create policy "admin write bands" on lolla.bands for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin update bands" on lolla.bands for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "authenticated read stage_distances" on lolla.stage_distances;
drop policy if exists "authenticated write stage_distances" on lolla.stage_distances;
drop policy if exists "admin write stage_distances" on lolla.stage_distances;
drop policy if exists "authenticated update stage_distances" on lolla.stage_distances;
drop policy if exists "admin update stage_distances" on lolla.stage_distances;
create policy "authenticated read stage_distances" on lolla.stage_distances for select using (auth.role() = 'authenticated');
create policy "admin write stage_distances" on lolla.stage_distances for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin update stage_distances" on lolla.stage_distances for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "authenticated read ratings" on lolla.ratings;
drop policy if exists "authenticated write ratings" on lolla.ratings;
drop policy if exists "self or admin write ratings" on lolla.ratings;
drop policy if exists "authenticated update ratings" on lolla.ratings;
drop policy if exists "self or admin update ratings" on lolla.ratings;
create policy "authenticated read ratings" on lolla.ratings for select using (auth.role() = 'authenticated');
create policy "self or admin write ratings" on lolla.ratings for insert with check (
  auth.role() = 'authenticated'
  and (
    user_name = (auth.jwt() -> 'user_metadata' ->> 'first_name')
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);
create policy "self or admin update ratings" on lolla.ratings for update using (
  auth.role() = 'authenticated'
  and (
    user_name = (auth.jwt() -> 'user_metadata' ->> 'first_name')
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

drop policy if exists "authenticated read schedule" on lolla.schedule;
drop policy if exists "authenticated write schedule" on lolla.schedule;
drop policy if exists "authenticated update schedule" on lolla.schedule;
create policy "authenticated read schedule" on lolla.schedule for select using (auth.role() = 'authenticated');
create policy "authenticated write schedule" on lolla.schedule for insert with check (auth.role() = 'authenticated');
create policy "authenticated update schedule" on lolla.schedule for update using (auth.role() = 'authenticated');

-- RLS policies alone aren't enough for a non-public schema: the API roles also
-- need schema/table-level grants, since REST access is denied by default here.
-- Deliberately not granting "anon" — every request must be from a logged-in account.
grant usage on schema lolla to authenticated, service_role;
grant select, insert, update, delete on lolla.bands, lolla.stage_distances,
  lolla.ratings, lolla.schedule
  to authenticated, service_role;
