-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  username text unique,
  avatar_url text,
  level text default 'recreational',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Game days (scheduled padel days)
create table game_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table game_days enable row level security;
create policy "Users manage own game days" on game_days for all using (auth.uid() = user_id);

-- Training sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  type text not null check (type in ('match', 'training', 'drill')),
  duration_minutes int,
  location text,
  notes text,
  created_at timestamptz default now()
);
alter table sessions enable row level security;
create policy "Users manage own sessions" on sessions for all using (auth.uid() = user_id);

-- Match results
create table match_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  partner_name text,
  opponent1_name text,
  opponent2_name text,
  score text,
  result text check (result in ('win', 'loss', 'unfinished')),
  created_at timestamptz default now()
);
alter table match_results enable row level security;
create policy "Users manage own match results" on match_results for all using (auth.uid() = user_id);

-- Fitness metrics
create table fitness_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  metric_type text not null check (metric_type in ('strength', 'endurance', 'recovery', 'speed')),
  value numeric,
  unit text,
  notes text,
  created_at timestamptz default now()
);
alter table fitness_metrics enable row level security;
create policy "Users manage own fitness metrics" on fitness_metrics for all using (auth.uid() = user_id);

-- Wellbeing logs
create table wellbeing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  sleep_hours numeric,
  sleep_quality int check (sleep_quality between 1 and 5),
  hrv int,
  energy_level int check (energy_level between 1 and 5),
  nutrition_quality int check (nutrition_quality between 1 and 5),
  hydration_liters numeric,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table wellbeing_logs enable row level security;
create policy "Users manage own wellbeing logs" on wellbeing_logs for all using (auth.uid() = user_id);

-- ELO ratings (one entry per session/match that affects rating)
create table elo_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  rating int not null default 1200,
  delta int default 0,
  session_id uuid references sessions(id) on delete set null,
  date date not null,
  created_at timestamptz default now()
);
alter table elo_ratings enable row level security;
create policy "Users manage own elo ratings" on elo_ratings for all using (auth.uid() = user_id);
