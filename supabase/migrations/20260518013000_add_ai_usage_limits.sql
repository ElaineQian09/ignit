create table if not exists public.ai_user_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  estimated_spend_cents integer not null default 0 check (estimated_spend_cents >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, usage_date)
);

create table if not exists public.ai_ip_hourly_usage (
  ip_address text not null,
  route_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (ip_address, route_key, window_start)
);

drop trigger if exists ai_user_daily_usage_set_updated_at on public.ai_user_daily_usage;
create trigger ai_user_daily_usage_set_updated_at
before update on public.ai_user_daily_usage
for each row execute function public.set_updated_at();

drop trigger if exists ai_ip_hourly_usage_set_updated_at on public.ai_ip_hourly_usage;
create trigger ai_ip_hourly_usage_set_updated_at
before update on public.ai_ip_hourly_usage
for each row execute function public.set_updated_at();

alter table public.ai_user_daily_usage enable row level security;
alter table public.ai_ip_hourly_usage enable row level security;

revoke all on public.ai_user_daily_usage from anon, authenticated;
revoke all on public.ai_ip_hourly_usage from anon, authenticated;

create or replace function public.check_and_record_ai_usage(
  p_user_id uuid,
  p_ip_address text,
  p_route_key text,
  p_request_count integer,
  p_estimated_spend_cents integer,
  p_user_daily_quota integer,
  p_ip_hourly_rate_limit integer,
  p_user_daily_spend_limit_cents integer
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_usage public.ai_user_daily_usage%rowtype;
  current_ip_usage public.ai_ip_hourly_usage%rowtype;
  current_time timestamptz := timezone('utc', now());
  current_usage_date date := current_time::date;
  current_window_start timestamptz := date_trunc('hour', current_time);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return query select false, 'unauthorized', null::integer;
    return;
  end if;

  if p_request_count <= 0 or p_estimated_spend_cents < 0 then
    return query select false, 'invalid_usage_request', null::integer;
    return;
  end if;

  insert into public.ai_user_daily_usage (user_id, usage_date)
  values (p_user_id, current_usage_date)
  on conflict (user_id, usage_date) do nothing;

  select *
  into current_user_usage
  from public.ai_user_daily_usage
  where user_id = p_user_id
    and usage_date = current_usage_date
  for update;

  if p_user_daily_quota > 0
    and current_user_usage.request_count + p_request_count > p_user_daily_quota then
    return query select false, 'user_daily_quota_exceeded', null::integer;
    return;
  end if;

  if p_user_daily_spend_limit_cents > 0
    and current_user_usage.estimated_spend_cents + p_estimated_spend_cents >
      p_user_daily_spend_limit_cents then
    return query select false, 'user_daily_spend_limit_exceeded', null::integer;
    return;
  end if;

  insert into public.ai_ip_hourly_usage (ip_address, route_key, window_start)
  values (coalesce(nullif(trim(p_ip_address), ''), 'unknown'), p_route_key, current_window_start)
  on conflict (ip_address, route_key, window_start) do nothing;

  select *
  into current_ip_usage
  from public.ai_ip_hourly_usage
  where ip_address = coalesce(nullif(trim(p_ip_address), ''), 'unknown')
    and route_key = p_route_key
    and window_start = current_window_start
  for update;

  if p_ip_hourly_rate_limit > 0
    and current_ip_usage.request_count + p_request_count > p_ip_hourly_rate_limit then
    return query
    select
      false,
      'ip_hourly_rate_limit_exceeded',
      greatest(1, extract(epoch from ((current_window_start + interval '1 hour') - current_time))::integer);
    return;
  end if;

  update public.ai_user_daily_usage
  set
    request_count = request_count + p_request_count,
    estimated_spend_cents = estimated_spend_cents + p_estimated_spend_cents
  where user_id = p_user_id
    and usage_date = current_usage_date;

  update public.ai_ip_hourly_usage
  set request_count = request_count + p_request_count
  where ip_address = coalesce(nullif(trim(p_ip_address), ''), 'unknown')
    and route_key = p_route_key
    and window_start = current_window_start;

  return query select true, 'ok', null::integer;
end;
$$;

grant execute on function public.check_and_record_ai_usage(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer
) to authenticated;
