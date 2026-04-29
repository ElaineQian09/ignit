import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormNotice } from "@/components/forms/form-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/utils";
import {
  AVOIDANCE_OPTIONS,
  WORK_STYLE_OPTIONS,
  type Goal,
  type Profile
} from "@/types/domain";

import { saveOnboarding } from "./actions";

interface OnboardingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OnboardingPage({
  searchParams
}: OnboardingPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const error = firstQueryValue(params.error);

  const [{ data: profileData }, { data: goalsData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("goals")
      .select("title")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
  ]);
  const profile = (profileData ?? null) as Profile | null;
  const goals = (goalsData ?? []) as Pick<Goal, "title">[];

  return (
    <AppShell>
      <div className="py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Onboarding
            </span>
            <h1 className="mt-3 text-4xl font-semibold">
              Teach Ignit how you actually get stuck.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
              This first profile powers low-resistance starts. Later, your RAG
              memory layer can retrieve old task patterns, stalled topics, and
              previous successful restarts from the same structure.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-[var(--border)] bg-white/60 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white"
          >
            Skip to dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <form action={saveOnboarding} className="surface rounded-[2rem] p-6 sm:p-8">
            <FormNotice message={error} tone="error" />

            <div className="mt-4 space-y-6">
              <div>
                <label htmlFor="bigGoals" className="label">
                  Big goals
                </label>
                <textarea
                  id="bigGoals"
                  name="bigGoals"
                  rows={5}
                  defaultValue={(goals ?? []).map((goal) => goal.title).join("\n")}
                  placeholder={"Refresh resume\nFinish system design prep\nShip portfolio update"}
                  className="field resize-none"
                  required
                />
                <p className="mt-2 text-sm text-[var(--muted)]">
                  One goal per line. These become your active goals on the dashboard.
                </p>
              </div>

              <div>
                <label htmlFor="preferredWorkHours" className="label">
                  Preferred work hours
                </label>
                <input
                  id="preferredWorkHours"
                  name="preferredWorkHours"
                  defaultValue={profile?.preferred_work_hours ?? ""}
                  placeholder="Mon-Thu, 8:30am-11:30am"
                  className="field"
                  required
                />
              </div>

              <div>
                <label htmlFor="workStyle" className="label">
                  Work style
                </label>
                <select
                  id="workStyle"
                  name="workStyle"
                  defaultValue={profile?.work_style ?? WORK_STYLE_OPTIONS[0]}
                  className="field"
                >
                  {WORK_STYLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="label">Common avoidance patterns</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {AVOIDANCE_OPTIONS.map((option) => {
                    const checked =
                      profile?.common_avoidance_patterns?.includes(option) ?? false;

                    return (
                      <label
                        key={option}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="commonAvoidancePatterns"
                          value={option}
                          defaultChecked={checked}
                          className="mt-1 h-4 w-4 rounded border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-8">
              <SubmitButton
                label="Save profile"
                pendingLabel="Saving..."
              />
            </div>
          </form>

          <aside className="space-y-6">
            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">What this enables</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <li>Personalized first steps instead of generic task breakdowns.</li>
                <li>Future RAG retrieval from previous stalls, wins, and patterns.</li>
                <li>A dashboard that shows what is safe to start today.</li>
              </ul>
            </div>

            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">Memory layer placeholder</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Today this scaffold stores onboarding notes in `memory_chunks`.
                Later you can add embeddings, semantic retrieval, and calendar-aware
                scheduling without changing the top-level UX.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
