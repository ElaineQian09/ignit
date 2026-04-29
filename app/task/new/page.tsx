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
          <h1 className="mt-4 text-4xl font-semibold">Create a new task</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Focus on the task that feels heavy right now. Ignit will generate a
            few safe starting actions instead of a full intimidating plan.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <form action={createTask} className="surface rounded-[2rem] p-6 sm:p-8">
            <FormNotice message={error} tone="error" />

            <div className="mt-4 space-y-6">
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

              <div>
                <label htmlFor="title" className="label">
                  Main task
                </label>
                <textarea
                  id="title"
                  name="title"
                  rows={4}
                  placeholder="Update my resume for the Atopia role"
                  className="field resize-none"
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="deadline" className="label">
                    Deadline
                  </label>
                  <input id="deadline" name="deadline" type="date" className="field" />
                </div>

                <div>
                  <label htmlFor="availableTime" className="label">
                    Available time
                  </label>
                  <select
                    id="availableTime"
                    name="availableTime"
                    defaultValue="15"
                    className="field"
                  >
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="25">25 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
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
                label="Generate micro-actions"
                pendingLabel="Creating task..."
              />
            </div>
          </form>

          <aside className="space-y-6">
            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">How Ignit thinks</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                The planner does not optimize for finishing. It optimizes for
                starting. The generated actions aim to be concrete, low-risk, and
                short enough to begin even under cognitive overload.
              </p>
            </div>

            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">RAG extension point</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                This page already records task context into `memory_chunks`.
                Later you can replace the deterministic planner with:
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                <li>Retrieve similar past stalls from embeddings.</li>
                <li>Fetch prior successful start patterns.</li>
                <li>Use calendar windows to place the smallest viable action.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
