-- Padelop schema — regenerated from the live database (project xojuzcmavezcowkqhfis) on 2026-07-06.
-- This file documents the live schema; changes are applied via Supabase migrations, not by running this file.

-- Default privileges for tables created by postgres in public:
-- authenticated and service_role get CRUD only; anon gets nothing.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to authenticated, service_role;

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  dominant_hand text check (dominant_hand in ('right', 'left')),
  play_level text,
  overall_goal text,
  club text,
  notification_prefs jsonb default '{"night_nudge": true, "morning_nudge": true}'::jsonb,
  created_at timestamptz default now(),
  "position" text,
  tournament_count integer default 0,
  playing_since text
);
alter table profiles enable row level security;
create policy "own profile" on profiles for all using ((select auth.uid()) = id);

-- Matches (played and upcoming)
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  "time" text,
  location text,
  result text check (result in ('win', 'loss', 'draw')),
  score text,
  feeling text,
  energy text,
  injury text,
  mental_before text,
  mental_during text,
  mental_after text,
  warmup text,
  well_done text[] default '{}',
  improved text[] default '{}',
  result_image_url text,
  created_at timestamptz default now(),
  court text,
  player_1 text,
  player_2 text,
  player_3 text,
  player_4 text,
  notes text,
  constraint matches_user_date_time_unique unique (user_id, date, "time")
);
alter table matches enable row level security;
create policy "own matches" on matches for all using ((select auth.uid()) = user_id);

-- Recurring match partners
create table match_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  contact_email text,
  created_at timestamptz default now()
);
alter table match_partners enable row level security;
create policy "own match_partners" on match_partners for all using ((select auth.uid()) = user_id);

-- Scouted opponents
create table opponents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  strong_points text[] default '{}',
  weak_points text[] default '{}',
  notes text,
  created_at timestamptz default now()
);
alter table opponents enable row level security;
create policy "own opponents" on opponents for all using ((select auth.uid()) = user_id);

-- Match <-> partner / opponent link tables (ownership via parent match)
create table match_partner_links (
  match_id uuid not null references matches (id) on delete cascade,
  partner_id uuid not null references match_partners (id) on delete cascade,
  primary key (match_id, partner_id)
);
alter table match_partner_links enable row level security;
create policy "own match_partner_links" on match_partner_links for all
  using (exists (select 1 from matches where matches.id = match_partner_links.match_id and matches.user_id = (select auth.uid())));

create table match_opponent_links (
  match_id uuid not null references matches (id) on delete cascade,
  opponent_id uuid not null references opponents (id) on delete cascade,
  primary key (match_id, opponent_id)
);
alter table match_opponent_links enable row level security;
create policy "own match_opponent_links" on match_opponent_links for all
  using (exists (select 1 from matches where matches.id = match_opponent_links.match_id and matches.user_id = (select auth.uid())));

-- Daily wellness check-ins
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sleep smallint check (sleep >= 1 and sleep <= 5),
  nutrition smallint check (nutrition >= 1 and nutrition <= 5),
  hydration smallint check (hydration >= 1 and hydration <= 5),
  energy smallint check (energy >= 1 and energy <= 5),
  stress smallint check (stress >= 1 and stress <= 5),
  created_at timestamptz default now(),
  nutrition_ai_score smallint,
  nutrition_ai_insight text,
  sleep_hours text,
  pain text,
  pain_areas text[],
  water_on_waking boolean,
  unique (user_id, date)
);
alter table check_ins enable row level security;
create policy "own check_ins" on check_ins for all using ((select auth.uid()) = user_id);

-- Training sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  drill_focus text,
  duration_mins smallint,
  notes text,
  created_at timestamptz default now()
);
alter table sessions enable row level security;
create policy "own sessions" on sessions for all using ((select auth.uid()) = user_id);

-- Meal logs
create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type text,
  description text,
  created_at timestamptz default now()
);
alter table nutrition_logs enable row level security;
create policy "own nutrition_logs" on nutrition_logs for all using ((select auth.uid()) = user_id);

-- Daily water intake
create table hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  ml integer not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);
alter table hydration_logs enable row level security;
create policy "own hydration_logs" on hydration_logs for all using ((select auth.uid()) = user_id);

-- Free-form notes, optionally linked to a match
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  body text,
  linked_match_id uuid references matches (id) on delete set null,
  created_at timestamptz default now()
);
alter table notes enable row level security;
create policy "own notes" on notes for all using ((select auth.uid()) = user_id);

-- Gear (racket, shoes, ...) — one row per type per user
create table gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text,
  name text,
  photo_url text,
  created_at timestamptz default now(),
  racket_type text,
  racket_since text,
  constraint gear_user_type_unique unique (user_id, type)
);
alter table gear enable row level security;
create policy "own gear" on gear for all using ((select auth.uid()) = user_id);

-- Tournaments
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  date date,
  result text,
  created_at timestamptz default now()
);
alter table tournaments enable row level security;
create policy "own tournaments" on tournaments for all using ((select auth.uid()) = user_id);

-- Web-push subscriptions
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "users manage own push subs" on push_subscriptions for all using ((select auth.uid()) = user_id);

-- Completed schedule tasks per day
create table schedule_done (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  tasks text[] not null default '{}',
  created_at timestamptz default now(),
  unique (user_id, date)
);
alter table schedule_done enable row level security;
create policy "Users manage own schedule_done" on schedule_done for all using ((select auth.uid()) = user_id);

-- Daily computed score snapshots
create table score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  overall smallint,
  recovery smallint,
  nutrition smallint,
  training smallint,
  wellbeing smallint,
  created_at timestamptz default now(),
  unique (user_id, date)
);
alter table score_snapshots enable row level security;
create policy "Users manage own score_snapshots" on score_snapshots for all using ((select auth.uid()) = user_id);

-- Covering indexes for FK columns (composite with date where the sync queries sort by it)
create index sessions_user_id_date_idx on sessions (user_id, date);
create index nutrition_logs_user_id_date_idx on nutrition_logs (user_id, date);
create index notes_user_id_date_idx on notes (user_id, date);
create index tournaments_user_id_date_idx on tournaments (user_id, date);
create index opponents_user_id_idx on opponents (user_id);
create index match_partners_user_id_idx on match_partners (user_id);
create index notes_linked_match_id_idx on notes (linked_match_id);
create index match_partner_links_partner_id_idx on match_partner_links (partner_id);
create index match_opponent_links_opponent_id_idx on match_opponent_links (opponent_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Safety net: enable RLS automatically on any new table created in public
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create event trigger ensure_rls on ddl_command_end
  execute function public.rls_auto_enable();

-- Storage: public gear-images bucket.
-- Object URLs are served via /object/public/ (no RLS); deliberately NO SELECT policy,
-- so the bucket cannot be listed/enumerated through the API.
insert into storage.buckets (id, name, public) values ('gear-images', 'gear-images', true);

create policy "Users can upload their own gear images" on storage.objects for insert to authenticated
  with check (bucket_id = 'gear-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their own gear images" on storage.objects for update to authenticated
  using (bucket_id = 'gear-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own gear images" on storage.objects for delete
  using (bucket_id = 'gear-images' and (storage.foldername(name))[1] = auth.uid()::text);
