import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormNotice } from "@/components/forms/form-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireOnboardedUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/utils";
import { ENERGY_LEVEL_OPTIONS } from "@/types/domain";

import { createTask } from "./actions";

interface TaskCreationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TaskCreationPage({
  searchParams
}: TaskCreationPageProps) {
  const { supabase } = await requireOnboardedUser();
  const params = await searchParams;
  const error = firstQueryValue(params.error);

  const { data: goalsData } = await supabase
    .from("goals")
    .select("id, title")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const goals = (goalsData ?? []) as Array<{ id: string; title: string }>;
  const primaryGoal = goals[0] ?? null;

  return (
    <AppShell>
      <div className="py-8">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[var(--teal)] hover:text-[var(--accent-strong)]"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-4 text-4xl font-semibold">Add a daily task</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Pick one thing you want to clear today. Ignit will break it into the
            smallest playable steps, and the reward is the point of the run.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <form action={createTask} className="surface rounded-[2rem] p-6 sm:p-8">
            <FormNotice message={error} tone="error" />

            <div className="mt-4 space-y-6">
              {primaryGoal ? (
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    Current big goal
                  </p>
                  <p className="mt-2 text-xl font-semibold">{primaryGoal.title}</p>
                  <input type="hidden" name="goalId" value={primaryGoal.id} />
                </div>
              ) : (
                <div>
                  <label htmlFor="goalId" className="label">
                    Goal
                  </label>
                  <select id="goalId" name="goalId" className="field" required>
                    <option value="">Select a goal</option>
                    {(goals ?? []).map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="title" className="label">
                  Today&apos;s task
                </label>
                <textarea
                  id="title"
                  name="title"
                  rows={3}
                  placeholder="Send the recruiter follow-up email"
                  className="field resize-none"
                  required
                />
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Keep it as one daily mission. Ignit will split it into tiny executable moves.
                </p>
              </div>

              <div>
                <label htmlFor="planTitles" className="label">
                  Optional stages
                </label>
                <textarea
                  id="planTitles"
                  name="planTitles"
                  rows={3}
                  placeholder={"Draft email\nProofread\nSend"}
                  className="field resize-none"
                />
                <p className="mt-2 text-sm text-[var(--muted)]">
                  One stage per line if you already know the sequence. Otherwise leave it blank.
                </p>
              </div>

              <div>
                <label htmlFor="reward" className="label">
                  Reward after task done
                </label>
                <input
                  id="reward"
                  name="reward"
                  type="text"
                  placeholder="Matcha latte and one guilt-free episode"
                  className="field"
                  required
                />
                <p className="mt-2 text-sm text-[var(--muted)]">
                  This should be the thing you actually want after clearing the task.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="deadline" className="label">
                    Deadline (optional)
                  </label>
                  <input id="deadline" name="deadline" type="date" className="field" />
                </div>

                <div>
                  <label htmlFor="availableTime" className="label">
                    Estimated time for this daily task
                  </label>
                  <input
                    id="availableTime"
                    name="availableTime"
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    defaultValue={25}
                    list="daily-task-time-options"
                    className="field"
                    required
                  />
                  <datalist id="daily-task-time-options">
                    <option value="15" />
                    <option value="25" />
                    <option value="45" />
                    <option value="60" />
                    <option value="90" />
                    <option value="120" />
                    <option value="180" />
                    <option value="300" />
                  </datalist>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    You can type your own number too, including long tasks like 180 or 300 minutes.
                  </p>
                </div>
              </div>

              <fieldset>
                <legend className="label">Energy level</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {ENERGY_LEVEL_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm font-medium capitalize"
                    >
                      <span>{option}</span>
                      <input
                        type="radio"
                        name="energyLevel"
                        value={option}
                        defaultChecked={option === "medium"}
                        className="h-4 w-4 border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-8">
              <SubmitButton
                label="Build my quest steps"
                pendingLabel="Creating task..."
              />
            </div>
          </form>

          <aside className="space-y-6">
            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">What happens next</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Ignit turns the daily task into one or two psychologically small micro-tasks.
                They should feel light enough to start without your brain pushing back.
              </p>
            </div>

            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">How the system thinks</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                The coordinator now checks four things before showing your next move:
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                <li>Your past stall patterns.</li>
                <li>What kind of resistance this task creates.</li>
                <li>Whether the generated step is small enough.</li>
                <li>Whether a safer fallback step is needed.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
