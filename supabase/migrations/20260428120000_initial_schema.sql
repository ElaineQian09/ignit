create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_work_hours text,
  work_style text,
  common_avoidance_patterns text[] default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  deadline date,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  deadline date,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.micro_actions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  action_text text not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('task_history', 'reflection', 'manual_note')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists micro_actions_set_updated_at on public.micro_actions;
create trigger micro_actions_set_updated_at
before update on public.micro_actions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.micro_actions enable row level security;
alter table public.memory_chunks enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id);

create policy "goals_select_own" on public.goals
for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals
for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
for update using (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals
for delete using (auth.uid() = user_id);

create policy "tasks_select_own" on public.tasks
for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
for delete using (auth.uid() = user_id);

create policy "micro_actions_select_by_task_owner" on public.micro_actions
for select using (
  exists (
    select 1
    from public.tasks
    where tasks.id = micro_actions.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "micro_actions_insert_by_task_owner" on public.micro_actions
for insert with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = micro_actions.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "micro_actions_update_by_task_owner" on public.micro_actions
for update using (
  exists (
    select 1
    from public.tasks
    where tasks.id = micro_actions.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "micro_actions_delete_by_task_owner" on public.micro_actions
for delete using (
  exists (
    select 1
    from public.tasks
    where tasks.id = micro_actions.task_id
      and tasks.user_id = auth.uid()
  )
);

create policy "memory_chunks_select_own" on public.memory_chunks
for select using (auth.uid() = user_id);
create policy "memory_chunks_insert_own" on public.memory_chunks
for insert with check (auth.uid() = user_id);
create policy "memory_chunks_update_own" on public.memory_chunks
for update using (auth.uid() = user_id);
create policy "memory_chunks_delete_own" on public.memory_chunks
for delete using (auth.uid() = user_id);

create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_goal_id_idx on public.tasks(goal_id);
create index if not exists micro_actions_task_id_idx on public.micro_actions(task_id);
create index if not exists memory_chunks_user_id_idx on public.memory_chunks(user_id);
create index if not exists memory_chunks_source_type_idx on public.memory_chunks(source_type);

