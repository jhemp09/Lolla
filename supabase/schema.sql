-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
--
-- Everything lives in its own "lolla" schema rather than "public" so it's clearly
-- separated from any other apps sharing this project (visible as its own group in
-- Table Editor, zero naming collisions). Policies here are permissive, suitable for
-- a small trusted friend-group app with no login. Do not put sensitive data in this
-- project: anyone with the URL + anon key can read/write these tables.
--
-- After running this, one manual step in the dashboard is required: go to
-- Integrations > Data API > Settings > Exposed schemas, and add "lolla" to the
-- list (comma-separated, alongside "public"). Postgres schemas aren't exposed to
-- the REST API by default, so skipping this step means the app can't reach these
-- tables.
--
-- Upgrading from an earlier version of this file: the "ratings"/"schedule" tables
-- gained a group_code column and their primary key changed, and "stage_distances"/
-- "group_schedule" are new. Since `create table if not exists` won't alter an
-- existing table, if you already ran an older version of this script, drop the
-- schema first (safe if it's still empty, which "tables exist but no rows" means
-- it is): run `drop schema if exists lolla cascade;` then this whole file again.
--
-- Note on groups: "bands" and "stage_distances" are global (one shared festival
-- lineup/map for everyone in this project). "ratings", "schedule", and
-- "group_schedule" are scoped by group_code — there's no real access control
-- between groups here (the anon key is shared by everyone), group_code is just
-- an application-level partition, not a security boundary.

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

create policy "public read bands" on lolla.bands for select using (true);
create policy "public write bands" on lolla.bands for insert with check (true);
create policy "public update bands" on lolla.bands for update using (true);

create policy "public read stage_distances" on lolla.stage_distances for select using (true);
create policy "public write stage_distances" on lolla.stage_distances for insert with check (true);
create policy "public update stage_distances" on lolla.stage_distances for update using (true);

create policy "public read ratings" on lolla.ratings for select using (true);
create policy "public write ratings" on lolla.ratings for insert with check (true);
create policy "public update ratings" on lolla.ratings for update using (true);

create policy "public read schedule" on lolla.schedule for select using (true);
create policy "public write schedule" on lolla.schedule for insert with check (true);
create policy "public update schedule" on lolla.schedule for update using (true);

create policy "public read group_schedule" on lolla.group_schedule for select using (true);
create policy "public write group_schedule" on lolla.group_schedule for insert with check (true);
create policy "public update group_schedule" on lolla.group_schedule for update using (true);
create policy "public delete group_schedule" on lolla.group_schedule for delete using (true);

-- RLS policies alone aren't enough for a non-public schema: the API roles also
-- need schema/table-level grants, since REST access is denied by default here.
grant usage on schema lolla to anon, authenticated, service_role;
grant select, insert, update, delete on lolla.bands, lolla.stage_distances,
  lolla.ratings, lolla.schedule, lolla.group_schedule
  to anon, authenticated, service_role;
