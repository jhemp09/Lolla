-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
-- Creates the three tables the app syncs, with permissive policies suitable
-- for a small trusted friend-group app with no login. Do not put sensitive
-- data in this project: anyone with the URL + anon key can read/write it.

create table if not exists bands (
  id text primary key,
  name text not null,
  stage text not null,
  day int not null,
  start_minutes int not null,
  end_minutes int not null,
  genre text not null,
  description text not null default ''
);

create table if not exists ratings (
  band_id text not null,
  user_name text not null,
  rating int not null,
  notes text not null default '',
  updated_at timestamptz not null,
  primary key (band_id, user_name)
);

create table if not exists schedule (
  band_id text not null,
  user_name text not null,
  added_at timestamptz not null,
  removed boolean not null default false,
  primary key (band_id, user_name)
);

alter table bands enable row level security;
alter table ratings enable row level security;
alter table schedule enable row level security;

create policy "public read bands" on bands for select using (true);
create policy "public write bands" on bands for insert with check (true);
create policy "public update bands" on bands for update using (true);

create policy "public read ratings" on ratings for select using (true);
create policy "public write ratings" on ratings for insert with check (true);
create policy "public update ratings" on ratings for update using (true);

create policy "public read schedule" on schedule for select using (true);
create policy "public write schedule" on schedule for insert with check (true);
create policy "public update schedule" on schedule for update using (true);
