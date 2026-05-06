alter table public.tasks
add column if not exists available_time_minutes integer;

alter table public.tasks
drop constraint if exists tasks_available_time_minutes_check,
add constraint tasks_available_time_minutes_check
  check (
    available_time_minutes is null
    or available_time_minutes between 5 and 180
  );
