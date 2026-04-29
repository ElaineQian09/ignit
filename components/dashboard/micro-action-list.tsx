import { completeMicroAction, startMicroAction } from "@/app/dashboard/actions";
import { formatDateTime } from "@/lib/utils";
import type { DashboardAction } from "@/types/domain";

export function MicroActionList({
  actions,
  hasActiveTasks
}: {
  actions: DashboardAction[];
  hasActiveTasks: boolean;
}) {
  if (actions.length === 0) {
    return (
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>
          {hasActiveTasks
            ? "You have active tasks, but there are no pending micro-actions to show."
            : "No micro-actions yet."}
        </p>
        <p>
          {hasActiveTasks
            ? "That usually means the task's start steps were finished, skipped, or never created."
            : "Create a task and Ignit will seed a low-resistance start."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <div
          key={action.id}
          className="rounded-[1.5rem] border border-[var(--border)] bg-white/75 px-4 py-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[rgba(15,118,110,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
              Start step {index + 1}
            </span>
            <span className="text-sm text-[var(--muted)]">
              {action.estimated_minutes} min
            </span>
          </div>
          <p className="text-base leading-7">{action.action_text}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!action.started_at ? (
              <form action={startMicroAction}>
                <input type="hidden" name="microActionId" value={action.id} />
                <button
                  type="submit"
                  className="rounded-full bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:opacity-90"
                >
                  Start work
                </button>
              </form>
            ) : null}
            <form action={completeMicroAction}>
              <input type="hidden" name="microActionId" value={action.id} />
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
              >
                ☑ Complete
              </button>
            </form>
            {action.started_at ? (
              <span className="text-xs text-[var(--muted)]">
                Started {formatDateTime(action.started_at)}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {action.goal_title ? `${action.goal_title} · ` : ""}
            {action.task_title}
          </p>
        </div>
      ))}
    </div>
  );
}
