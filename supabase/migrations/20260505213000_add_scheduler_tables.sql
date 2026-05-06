create table if not exists public.user_schedule_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_days text[] default '{}',
  preferred_start_time time,
  preferred_end_time time,
  max_daily_focus_minutes integer,
  preferred_session_minutes integer,
  break_minutes integer,
  high_energy_periods jsonb default '[]'::jsonb,
  low_energy_periods jsonb default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_schedule_preferences_max_daily_focus_minutes_check
    check (max_daily_focus_minutes is null or max_daily_focus_minutes between 30 and 720),
  constraint user_schedule_preferences_preferred_session_minutes_check
    check (preferred_session_minutes is null or preferred_session_minutes between 5 and 180),
  constraint user_schedule_preferences_break_minutes_check
    check (break_minutes is null or break_minutes between 1 and 60)
);

create table if not exists public.scheduled_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  micro_action_id uuid references public.micro_actions(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped', 'cancelled')),
  schedule_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint scheduled_blocks_time_order_check check (end_time > start_time)
);

drop trigger if exists user_schedule_preferences_set_updated_at on public.user_schedule_preferences;
create trigger user_schedule_preferences_set_updated_at
before update on public.user_schedule_preferences
for each row execute function public.set_updated_at();

drop trigger if exists scheduled_blocks_set_updated_at on public.scheduled_blocks;
create trigger scheduled_blocks_set_updated_at
before update on public.scheduled_blocks
for each row execute function public.set_updated_at();

alter table public.user_schedule_preferences enable row level security;
alter table public.scheduled_blocks enable row level security;

create policy "user_schedule_preferences_select_own" on public.user_schedule_preferences
for select using (auth.uid() = user_id);
create policy "user_schedule_preferences_insert_own" on public.user_schedule_preferences
for insert with check (auth.uid() = user_id);
create policy "user_schedule_preferences_update_own" on public.user_schedule_preferences
for update using (auth.uid() = user_id);
create policy "user_schedule_preferences_delete_own" on public.user_schedule_preferences
for delete using (auth.uid() = user_id);

create policy "scheduled_blocks_select_own" on public.scheduled_blocks
for select using (auth.uid() = user_id);
create policy "scheduled_blocks_insert_own" on public.scheduled_blocks
for insert with check (auth.uid() = user_id);
create policy "scheduled_blocks_update_own" on public.scheduled_blocks
for update using (auth.uid() = user_id);
create policy "scheduled_blocks_delete_own" on public.scheduled_blocks
for delete using (auth.uid() = user_id);

create index if not exists user_schedule_preferences_user_id_idx
  on public.user_schedule_preferences(user_id);
create index if not exists scheduled_blocks_user_id_idx
  on public.scheduled_blocks(user_id);
create index if not exists scheduled_blocks_task_id_idx
  on public.scheduled_blocks(task_id);
create index if not exists scheduled_blocks_micro_action_id_idx
  on public.scheduled_blocks(micro_action_id);
create index if not exists scheduled_blocks_start_time_idx
  on public.scheduled_blocks(start_time);
