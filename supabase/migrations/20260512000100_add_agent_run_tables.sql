create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  workflow text not null default 'micro_action_planning',
  trigger_source text not null
    check (trigger_source in ('task_creation', 'api_generate_micro_action', 'schedule_recovery', 'manual_replan')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  input jsonb,
  shared_state jsonb not null default '{}'::jsonb,
  final_output jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_name text not null,
  step_kind text not null
    check (step_kind in ('agent_result', 'handoff', 'decision', 'error')),
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed', 'skipped')),
  input jsonb,
  output jsonb,
  summary text,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists agent_runs_set_updated_at on public.agent_runs;
create trigger agent_runs_set_updated_at
before update on public.agent_runs
for each row execute function public.set_updated_at();

alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;

create policy "agent_runs_select_own" on public.agent_runs
for select using (auth.uid() = user_id);
create policy "agent_runs_insert_own" on public.agent_runs
for insert with check (auth.uid() = user_id);
create policy "agent_runs_update_own" on public.agent_runs
for update using (auth.uid() = user_id);
create policy "agent_runs_delete_own" on public.agent_runs
for delete using (auth.uid() = user_id);

create policy "agent_steps_select_by_run_owner" on public.agent_steps
for select using (
  exists (
    select 1
    from public.agent_runs
    where agent_runs.id = agent_steps.agent_run_id
      and agent_runs.user_id = auth.uid()
  )
);
create policy "agent_steps_insert_by_run_owner" on public.agent_steps
for insert with check (
  exists (
    select 1
    from public.agent_runs
    where agent_runs.id = agent_steps.agent_run_id
      and agent_runs.user_id = auth.uid()
  )
);
create policy "agent_steps_update_by_run_owner" on public.agent_steps
for update using (
  exists (
    select 1
    from public.agent_runs
    where agent_runs.id = agent_steps.agent_run_id
      and agent_runs.user_id = auth.uid()
  )
);
create policy "agent_steps_delete_by_run_owner" on public.agent_steps
for delete using (
  exists (
    select 1
    from public.agent_runs
    where agent_runs.id = agent_steps.agent_run_id
      and agent_runs.user_id = auth.uid()
  )
);

create index if not exists agent_runs_user_id_idx on public.agent_runs(user_id);
create index if not exists agent_runs_task_id_idx on public.agent_runs(task_id);
create index if not exists agent_runs_plan_id_idx on public.agent_runs(plan_id);
create index if not exists agent_runs_status_idx on public.agent_runs(status);
create index if not exists agent_steps_agent_run_id_idx on public.agent_steps(agent_run_id);
create index if not exists agent_steps_agent_name_idx on public.agent_steps(agent_name);
