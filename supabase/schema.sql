-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
--
-- Everything lives in its own "lolla" schema rather than "public" so it's clearly
-- separated from any other apps sharing this project (visible as its own group in
-- Table Editor, zero naming collisions). Policies here are permissive, suitable for
-- a small trusted friend-group app with no login. Do not put sensitive data in this
-- project: anyone with the URL + anon key can read/write these three tables.
--
-- After running this, one manual step in the dashboard is required: go to
-- Project Settings > API > Exposed schemas, and add "lolla" to the list
-- (comma-separated, alongside "public"). Postgres schemas aren't exposed to the
-- REST API by default, so skipping this step means the app can't reach these tables.

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

create table if not exists lolla.ratings (
  band_id text not null,
  user_name text not null,
  rating int not null,
  notes text not null default '',
  updated_at timestamptz not null,
  primary key (band_id, user_name)
);

create table if not exists lolla.schedule (
  band_id text not null,
  user_name text not null,
  added_at timestamptz not null,
  removed boolean not null default false,
  primary key (band_id, user_name)
);

alter table lolla.bands enable row level security;
alter table lolla.ratings enable row level security;
alter table lolla.schedule enable row level security;

create policy "public read bands" on lolla.bands for select using (true);
create policy "public write bands" on lolla.bands for insert with check (true);
create policy "public update bands" on lolla.bands for update using (true);

create policy "public read ratings" on lolla.ratings for select using (true);
create policy "public write ratings" on lolla.ratings for insert with check (true);
create policy "public update ratings" on lolla.ratings for update using (true);

create policy "public read schedule" on lolla.schedule for select using (true);
create policy "public write schedule" on lolla.schedule for insert with check (true);
create policy "public update schedule" on lolla.schedule for update using (true);

-- RLS policies alone aren't enough for a non-public schema: the API roles also
-- need schema/table-level grants, since REST access is denied by default here.
grant usage on schema lolla to anon, authenticated, service_role;
grant select, insert, update on lolla.bands, lolla.ratings, lolla.schedule
  to anon, authenticated, service_role;
