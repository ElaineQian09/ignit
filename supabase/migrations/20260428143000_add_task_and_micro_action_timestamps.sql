alter table public.tasks
add column if not exists started_at timestamptz,
add column if not exists completed_at timestamptz;

alter table public.micro_actions
add column if not exists started_at timestamptz,
add column if not exists completed_at timestamptz;

create index if not exists tasks_started_at_idx on public.tasks(started_at);
create index if not exists tasks_completed_at_idx on public.tasks(completed_at);
create index if not exists micro_actions_started_at_idx on public.micro_actions(started_at);
create index if not exists micro_actions_completed_at_idx on public.micro_actions(completed_at);
