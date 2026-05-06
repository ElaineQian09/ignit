create table if not exists public.memory_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'schedule_success',
      'schedule_failure',
      'block_completed',
      'block_skipped',
      'block_rescheduled',
      'block_need_more_time'
    )
  ),
  summary text not null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.memory_logs enable row level security;

create policy "memory_logs_select_own" on public.memory_logs
for select using (auth.uid() = user_id);
create policy "memory_logs_insert_own" on public.memory_logs
for insert with check (auth.uid() = user_id);
create policy "memory_logs_update_own" on public.memory_logs
for update using (auth.uid() = user_id);
create policy "memory_logs_delete_own" on public.memory_logs
for delete using (auth.uid() = user_id);

create index if not exists memory_logs_user_id_idx on public.memory_logs(user_id);
create index if not exists memory_logs_event_type_idx on public.memory_logs(event_type);

alter table public.scheduled_blocks
add column if not exists rescheduled_from_block_id uuid references public.scheduled_blocks(id) on delete set null;

alter table public.scheduled_blocks
drop constraint if exists scheduled_blocks_status_check,
add constraint scheduled_blocks_status_check
  check (
    status in (
      'scheduled',
      'in_progress',
      'completed',
      'skipped',
      'rescheduled',
      'cancelled'
    )
  );
