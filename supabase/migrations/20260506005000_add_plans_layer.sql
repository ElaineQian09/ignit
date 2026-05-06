create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  status text not null default 'queued' check (status in ('active', 'queued', 'done', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

create policy "plans_select_by_task_owner" on public.plans
for select using (
  exists (
    select 1
    from public.tasks
    where tasks.id = plans.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "plans_insert_by_task_owner" on public.plans
for insert with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = plans.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "plans_update_by_task_owner" on public.plans
for update using (
  exists (
    select 1
    from public.tasks
    where tasks.id = plans.task_id
      and tasks.user_id = auth.uid()
  )
);
create policy "plans_delete_by_task_owner" on public.plans
for delete using (
  exists (
    select 1
    from public.tasks
    where tasks.id = plans.task_id
      and tasks.user_id = auth.uid()
  )
);

create index if not exists plans_task_id_idx on public.plans(task_id);
create index if not exists plans_task_id_sort_order_idx on public.plans(task_id, sort_order);

alter table public.micro_actions
add column if not exists plan_id uuid references public.plans(id) on delete cascade;

insert into public.plans (task_id, title, status, sort_order)
select tasks.id, tasks.title, 'active', 0
from public.tasks
where not exists (
  select 1
  from public.plans
  where plans.task_id = tasks.id
);

update public.micro_actions
set plan_id = plans.id
from public.plans
where plans.task_id = micro_actions.task_id
  and plans.sort_order = 0
  and micro_actions.plan_id is null;

alter table public.micro_actions
alter column plan_id set not null;

create index if not exists micro_actions_plan_id_idx on public.micro_actions(plan_id);
