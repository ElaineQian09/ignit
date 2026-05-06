import { completeTask, updateTaskAvailableTime } from "@/app/dashboard/actions";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/domain";

export function TaskList({
  tasks,
  hasActiveGoals
}: {
  tasks: TaskWithRelations[];
  hasActiveGoals: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>
          {hasActiveGoals
            ? "You have an active goal, but no task under it yet."
            : "No active tasks yet."}
        </p>
        <p>
          {hasActiveGoals
            ? "Goals stay broad. Add a task under that goal, and Ignit will generate the first micro-actions."
            : "Create one and Ignit will generate the first micro-actions."}
        </p>
      </div>
    );
  }

  const [focusTask, ...queuedTasks] = tasks;
  const focusPlan =
    focusTask.plans.find((plan) => plan.status === "active") ?? focusTask.plans[0] ?? null;
  const queuedPlans = focusTask.plans.filter((plan) => plan.status === "queued");
  const pendingFocusMicroActions =
    focusPlan?.micro_actions.filter((action) => action.status === "pending").length ?? 0;
  const pendingTaskMicroActions = focusTask.micro_actions.filter(
    (action) => action.status === "pending"
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[1.75rem] border border-[var(--border)] bg-white/80 p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="rounded-full bg-[rgba(235,91,44,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
              Current focus
            </span>
            <p className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">
              {focusTask.title}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {focusTask.goal_title ?? "Unassigned goal"}
            </p>
            {focusTask.started_at ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Started {formatDateTime(focusTask.started_at)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <span className="text-sm text-[var(--muted)]">
              {formatDate(focusTask.deadline)}
            </span>
            <form action={completeTask}>
              <input type="hidden" name="taskId" value={focusTask.id} />
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
              >
                ☑ Done
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:items-start">
          <div className="space-y-4">
            {focusPlan ? (
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(235,91,44,0.06)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  Active plan
                </p>
                <div className="mt-3 space-y-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-7 sm:text-xl">
                      {focusPlan.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {pendingFocusMicroActions} pending micro-actions in this plan
                    </p>
                  </div>
                  {queuedPlans.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        Up next
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {queuedPlans.map((plan) => (
                          <span
                            key={plan.id}
                            className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            {plan.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  In this task
                </p>
                <p className="mt-2 text-2xl font-semibold">{pendingTaskMicroActions}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  pending micro-actions across the full task
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Planning note
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Keep the task broad. Session time tells Ignit how much of this
                  workstream to touch in the next block, not how long the whole
                  task should take.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/72 p-4 sm:p-5">
            <form action={updateTaskAvailableTime} className="space-y-3">
              <input type="hidden" name="taskId" value={focusTask.id} />
              <div>
                <label
                  htmlFor={`availableTime-${focusTask.id}`}
                  className="mb-2 block text-sm font-medium text-[var(--foreground)]"
                >
                  Session time
                </label>
                <select
                  id={`availableTime-${focusTask.id}`}
                  name="availableTime"
                  defaultValue={String(focusTask.available_time_minutes ?? 15)}
                  className="field w-full"
                >
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="25">25 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Update the size of the next focused work block for this task.
              </p>
              <button
                type="submit"
                className="w-full rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
              >
                Update time
              </button>
            </form>
          </div>
        </div>
      </div>

      {queuedTasks.length > 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/55 px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Queued next
          </p>
          <div className="mt-3 space-y-3">
            {queuedTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {task.goal_title ?? "Unassigned goal"}
                    </p>
                    {task.plans.find((plan) => plan.status === "active") ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Current plan:{" "}
                        {task.plans.find((plan) => plan.status === "active")?.title}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    {task.available_time_minutes ?? 15} min session
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
