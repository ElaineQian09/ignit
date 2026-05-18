drop policy if exists "scheduled_blocks_insert_own" on public.scheduled_blocks;
create policy "scheduled_blocks_insert_own" on public.scheduled_blocks
for insert with check (
  auth.uid() = user_id
  and (
    task_id is null
    or exists (
      select 1
      from public.tasks
      where tasks.id = scheduled_blocks.task_id
        and tasks.user_id = auth.uid()
    )
  )
  and (
    micro_action_id is null
    or exists (
      select 1
      from public.micro_actions
      join public.tasks on tasks.id = micro_actions.task_id
      where micro_actions.id = scheduled_blocks.micro_action_id
        and tasks.user_id = auth.uid()
    )
  )
);

drop policy if exists "scheduled_blocks_update_own" on public.scheduled_blocks;
create policy "scheduled_blocks_update_own" on public.scheduled_blocks
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    task_id is null
    or exists (
      select 1
      from public.tasks
      where tasks.id = scheduled_blocks.task_id
        and tasks.user_id = auth.uid()
    )
  )
  and (
    micro_action_id is null
    or exists (
      select 1
      from public.micro_actions
      join public.tasks on tasks.id = micro_actions.task_id
      where micro_actions.id = scheduled_blocks.micro_action_id
        and tasks.user_id = auth.uid()
    )
  )
);
