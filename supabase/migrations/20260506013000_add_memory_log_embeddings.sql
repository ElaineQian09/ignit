create extension if not exists vector;

alter table public.memory_logs
add column if not exists embedding vector(1536);

create index if not exists memory_logs_embedding_idx
on public.memory_logs
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function public.match_memory_logs(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer default 5
)
returns table (
  id uuid,
  summary text,
  event_type text,
  metadata jsonb,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    memory_logs.id,
    memory_logs.summary,
    memory_logs.event_type,
    memory_logs.metadata,
    memory_logs.created_at,
    1 - (memory_logs.embedding <=> query_embedding) as similarity
  from public.memory_logs
  where memory_logs.user_id = match_user_id
    and memory_logs.embedding is not null
  order by memory_logs.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
