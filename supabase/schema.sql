-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
--
-- Everything lives in its own "lolla" schema rather than "public" so it's clearly
-- separated from any other apps sharing this project (visible as its own group in
-- Table Editor, zero naming collisions).
--
-- After running this, TWO manual dashboard steps are required:
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
-- Upgrading from an earlier version of this file: policies changed from public
-- (anyone with the anon key) to requiring a logged-in account, and "ratings"/
-- "schedule" gained a group_code column with a new primary key. Since
-- `create table if not exists` won't alter an existing table, if you already
-- ran an older version of this script, drop the schema first (safe if it's
-- still empty): run `drop schema if exists lolla cascade;` then this whole
-- file again.
--
-- Note on groups: "bands" and "stage_distances" are global (one shared festival
-- lineup/map for everyone in this project). "ratings", "schedule", and
-- "group_schedule" are scoped by group_code. Access control is now real (every
-- request must come from a logged-in Supabase Auth user), but group_code
-- itself is still just an application-level partition, not a security boundary
-- — any logged-in account in this project can read/write any group's rows.
-- Fine for a casual friend-group app; don't put anything sensitive here.

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
  rating int not null,
  notes text not null default '',
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

create table if not exists lolla.group_schedule (
  group_code text not null,
  day int not null,
  "order" int not null,
  band_id text not null,
  generated_at timestamptz not null,
  primary key (group_code, day, "order")
);

alter table lolla.bands enable row level security;
alter table lolla.stage_distances enable row level security;
alter table lolla.ratings enable row level security;
alter table lolla.schedule enable row level security;
alter table lolla.group_schedule enable row level security;

create policy "authenticated read bands" on lolla.bands for select using (auth.role() = 'authenticated');
create policy "authenticated write bands" on lolla.bands for insert with check (auth.role() = 'authenticated');
create policy "authenticated update bands" on lolla.bands for update using (auth.role() = 'authenticated');

create policy "authenticated read stage_distances" on lolla.stage_distances for select using (auth.role() = 'authenticated');
create policy "authenticated write stage_distances" on lolla.stage_distances for insert with check (auth.role() = 'authenticated');
create policy "authenticated update stage_distances" on lolla.stage_distances for update using (auth.role() = 'authenticated');

create policy "authenticated read ratings" on lolla.ratings for select using (auth.role() = 'authenticated');
create policy "authenticated write ratings" on lolla.ratings for insert with check (auth.role() = 'authenticated');
create policy "authenticated update ratings" on lolla.ratings for update using (auth.role() = 'authenticated');

create policy "authenticated read schedule" on lolla.schedule for select using (auth.role() = 'authenticated');
create policy "authenticated write schedule" on lolla.schedule for insert with check (auth.role() = 'authenticated');
create policy "authenticated update schedule" on lolla.schedule for update using (auth.role() = 'authenticated');

create policy "authenticated read group_schedule" on lolla.group_schedule for select using (auth.role() = 'authenticated');
create policy "authenticated write group_schedule" on lolla.group_schedule for insert with check (auth.role() = 'authenticated');
create policy "authenticated update group_schedule" on lolla.group_schedule for update using (auth.role() = 'authenticated');
create policy "authenticated delete group_schedule" on lolla.group_schedule for delete using (auth.role() = 'authenticated');

-- RLS policies alone aren't enough for a non-public schema: the API roles also
-- need schema/table-level grants, since REST access is denied by default here.
-- Deliberately not granting "anon" — every request must be from a logged-in account.
grant usage on schema lolla to authenticated, service_role;
grant select, insert, update, delete on lolla.bands, lolla.stage_distances,
  lolla.ratings, lolla.schedule, lolla.group_schedule
  to authenticated, service_role;
