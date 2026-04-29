import { completeTask } from "@/app/dashboard/actions";
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

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {task.goal_title ?? "Unassigned goal"}
              </p>
              {task.started_at ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Started {formatDateTime(task.started_at)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)]">
                {formatDate(task.deadline)}
              </span>
              <form action={completeTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
                >
                  ☑ Done
                </button>
              </form>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {task.micro_actions.filter((action) => action.status === "pending").length} pending micro-actions
          </p>
        </div>
      ))}
    </div>
  );
}
