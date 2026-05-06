alter table public.profiles
add column if not exists preferred_work_days text[] default '{}',
add column if not exists max_daily_focus_minutes integer,
add column if not exists preferred_session_length integer,
add column if not exists break_length integer,
add column if not exists low_energy_time_periods text[] default '{}',
add column if not exists high_energy_time_periods text[] default '{}';

alter table public.profiles
drop constraint if exists profiles_max_daily_focus_minutes_check,
add constraint profiles_max_daily_focus_minutes_check
  check (max_daily_focus_minutes is null or max_daily_focus_minutes between 30 and 720),
drop constraint if exists profiles_preferred_session_length_check,
add constraint profiles_preferred_session_length_check
  check (preferred_session_length is null or preferred_session_length between 5 and 180),
drop constraint if exists profiles_break_length_check,
add constraint profiles_break_length_check
  check (break_length is null or break_length between 1 and 60);
