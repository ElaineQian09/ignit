import { formatDate } from "@/lib/utils";
import type { Goal } from "@/types/domain";
import { pauseGoal } from "@/app/dashboard/actions";

export function GoalList({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No active goals yet. Add one from onboarding.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => (
        <div
          key={goal.id}
          className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">{goal.title}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {formatDate(goal.deadline)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {goal.status}
              </span>
              <form action={pauseGoal}>
                <input type="hidden" name="goalId" value={goal.id} />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
                >
                  Pause
                </button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
