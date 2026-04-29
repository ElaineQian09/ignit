import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GoalList } from "@/components/dashboard/goal-list";
import { MicroActionList } from "@/components/dashboard/micro-action-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { TaskList } from "@/components/dashboard/task-list";
import { FormNotice } from "@/components/forms/form-notice";
import { getDashboardData } from "@/lib/data/dashboard";
import { firstQueryValue } from "@/lib/utils";
import { requireOnboardedUser } from "@/lib/auth";

import { signOut } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps) {
  const { user, profile } = await requireOnboardedUser();
  const { activeGoals, activeTasks, todayMicroActions } = await getDashboardData(
    user.id
  );
  const params = await searchParams;
  const success = firstQueryValue(params.success);
  const error = firstQueryValue(params.error);

  return (
    <AppShell>
      <div className="py-8">
        <header className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-[var(--border)] bg-white/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Dashboard
            </span>
            <h1 className="mt-3 text-4xl font-semibold">
              Start smaller, earlier, and with less resistance.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {profile.work_style} work style · Preferred focus window:{" "}
              {profile.preferred_work_hours}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/task/new"
              className="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              Add task
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
            >
              Edit profile
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <FormNotice message={success} tone="success" />
        <FormNotice message={error} tone="error" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <SectionCard
              title="Today's micro-actions"
              description="These are intentionally tiny and safe to start."
            >
              <MicroActionList
                actions={todayMicroActions}
                hasActiveTasks={activeTasks.length > 0}
              />
            </SectionCard>

            <SectionCard
              title="Active tasks"
              description="The current task queue feeding your next actions."
            >
              <TaskList
                tasks={activeTasks}
                hasActiveGoals={activeGoals.length > 0}
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Active goals"
              description="Big goals stay visible, but your next move stays small."
            >
              <GoalList goals={activeGoals} />
            </SectionCard>

            <SectionCard
              title="Memory-ready profile"
              description="The retrieval layer will use these preferences and patterns later."
            >
              <div className="space-y-4 text-sm text-[var(--muted)]">
                <p>
                  <span className="font-semibold text-[var(--foreground)]">
                    Avoidance patterns:
                  </span>{" "}
                  {profile.common_avoidance_patterns?.join(", ") ?? "None set"}
                </p>
                <p>
                  <span className="font-semibold text-[var(--foreground)]">
                    User:
                  </span>{" "}
                  {user.email}
                </p>
                <p>
                  RAG note: `memory_chunks` is already in the schema, so you can
                  begin storing reflections, past stalls, and successful starts
                  without changing the dashboard contract.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
