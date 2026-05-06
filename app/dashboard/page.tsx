import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CompletionStatsCard } from "@/components/dashboard/completion-stats";
import { ScheduleBlockList } from "@/components/dashboard/schedule-block-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { TaskList } from "@/components/dashboard/task-list";
import { FormNotice } from "@/components/forms/form-notice";
import { getDashboardData } from "@/lib/data/dashboard";
import { firstQueryValue } from "@/lib/utils";
import { requireOnboardedUser } from "@/lib/auth";
import type { UserSchedulePreferences } from "@/types/domain";

import { signOut } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps) {
  const { supabase, user, profile } = await requireOnboardedUser();
  const { activeGoals, activeTasks, todaySchedule, upcomingSchedule, completionStats } =
    await getDashboardData(
      user.id
    );
  const params = await searchParams;
  const success = firstQueryValue(params.success);
  const error = firstQueryValue(params.error);
  const { data: preferencesData } = await supabase
    .from("user_schedule_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const preferences =
    (preferencesData ?? null) as UserSchedulePreferences | null;
  const focusWindow =
    preferences?.preferred_start_time && preferences?.preferred_end_time
      ? `${preferences.preferred_start_time}-${preferences.preferred_end_time}`
      : "Not set";

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
              {focusWindow}
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
            <Link
              href="/settings/schedule"
              className="inline-flex rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
            >
              Schedule settings
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

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <SectionCard
              title="Today's Plan"
              description="Small, realistic blocks for today only."
            >
              <ScheduleBlockList
                blocks={todaySchedule}
                emptyTitle="No scheduled blocks for today."
                emptyBody="Create a task or configure your schedule settings, and Ignit will build a calm plan here."
              />
            </SectionCard>

            <SectionCard
              title="Upcoming Blocks"
              description="What is already queued after today."
            >
              <ScheduleBlockList
                blocks={upcomingSchedule}
                emptyTitle="No upcoming blocks yet."
                emptyBody="Future slots will appear here after Ignit spreads work across the next safe windows."
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Active tasks"
              description="One focus task at a time, with the rest queued behind it."
            >
              <TaskList
                tasks={activeTasks}
                hasActiveGoals={activeGoals.length > 0}
              />
            </SectionCard>

            <SectionCard
              title="Streak / Completed Micro-actions"
              description="Progress without turning the app into pressure."
            >
              <CompletionStatsCard stats={completionStats} />
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-4 text-sm text-[var(--muted)]">
                <p>
                  {profile.work_style} work style · Focus window: {focusWindow}
                </p>
                <p className="mt-2">
                  Daily cap:{" "}
                  {preferences?.max_daily_focus_minutes
                    ? `${preferences.max_daily_focus_minutes} minutes`
                    : "Not set"}
                </p>
                <p className="mt-2">
                  Session / break:{" "}
                  {preferences?.preferred_session_minutes &&
                  preferences.break_minutes
                    ? `${preferences.preferred_session_minutes} min focus / ${preferences.break_minutes} min break`
                    : "Not set"}
                </p>
                <p className="mt-2">
                  Avoidance patterns:{" "}
                  {profile.common_avoidance_patterns?.join(", ") ?? "None set"}
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
