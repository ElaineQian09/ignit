import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CompletionStatsCard } from "@/components/dashboard/completion-stats";
import { TaskList } from "@/components/dashboard/task-list";
import { FormNotice } from "@/components/forms/form-notice";
import { requireOnboardedUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { firstQueryValue } from "@/lib/utils";

import { signOut } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps) {
  const { user, profile } = await requireOnboardedUser();
  const { activeGoals, activeTasks, completedTasks, completionStats } =
    await getDashboardData(user.id);
  const params = await searchParams;
  const success = firstQueryValue(params.success);
  const error = firstQueryValue(params.error);
  const primaryGoal = activeGoals[0] ?? null;

  return (
    <AppShell>
      <div className="py-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Ignit
            </span>
            <h1 className="mt-3 text-5xl font-semibold leading-tight">
              A clear next step beats a crowded dashboard.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
              {profile.work_style} mode. This page is now structured to reward progress first, then guide you through one straight execution path.
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
              Edit big goal
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

        <div className="mt-6 space-y-6">
          <CompletionStatsCard stats={completionStats} />

          <section className="quest-hero-panel rounded-[2.4rem] p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Big goal
            </p>
            <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
              {primaryGoal?.title ?? "No big goal set yet."}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {primaryGoal
                ? "This is the long-term direction. The daily task below is just today's move toward it."
                : "Set one long-term goal in onboarding so the daily task has a clear strategic direction."}
            </p>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Execution line
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Big goal → daily task → micro-task → reward</h2>
            </div>
            <TaskList
              tasks={activeTasks}
              completedTasks={completedTasks}
              hasActiveGoals={activeGoals.length > 0}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
