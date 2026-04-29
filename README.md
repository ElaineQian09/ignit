# Ignit

Ignit is a personalized micro-action planner focused on reducing activation energy. This scaffold includes:

- Next.js 15 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth
- Supabase Postgres schema and migrations
- Core flows for login, onboarding, dashboard, and task creation
- A lightweight planning layer with explicit hooks for future RAG memory retrieval

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in your Supabase URL and publishable key.
3. Run `npm install`.
4. Run `npm run dev`.
5. Apply the SQL in `supabase/migrations/20260428120000_initial_schema.sql`.

## Current routes

- `/login`
- `/onboarding`
- `/dashboard`
- `/task/new`

## Notes

- `memory_chunks` is included as the first persistence layer for future RAG-based retrieval.
- The current planner is deterministic and production-safe. You can later swap `lib/planner.ts` for an embedding + retrieval + LLM pipeline without changing the UI flow.

