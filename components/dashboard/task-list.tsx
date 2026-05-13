import {
  completeMicroAction,
  completeTask,
  swapMicroTask,
  updateTaskAvailableTime
} from "@/app/dashboard/actions";
import {
  daysRemainingLabel,
  formatDate,
  formatDurationMinutes
} from "@/lib/utils";
import type { MicroAction, TaskWithRelations } from "@/types/domain";

function ProgressBar({
  completedCount,
  totalCount
}: {
  completedCount: number;
  totalCount: number;
}) {
  const percent = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  return (
    <div className="rounded-[1.4rem] border border-[var(--border)] bg-white/72 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{completedCount}/{totalCount} micro-tasks done</p>
        <span className="text-xs text-[var(--muted)]">{Math.round(percent)}%</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(31,20,11,0.08)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#ffb14a)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MicroTaskCard({
  action,
  taskId
}: {
  action: MicroAction | null;
  taskId: string;
}) {
  if (!action) {
    return (
      <div className="rounded-[1.7rem] border border-[var(--border)] bg-white/78 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          Micro-task
        </p>
        <h4 className="mt-3 text-2xl font-semibold">All micro-tasks are done</h4>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          There is no active micro-task left here. You can close the daily task and take the reward.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.7rem] border border-[var(--border)] bg-white/78 p-5 shadow-[0_18px_40px_rgba(72,44,18,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[rgba(235,91,44,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          Current micro-task
        </span>
        <span className="text-xs text-[var(--muted)]">Small enough to start</span>
      </div>

      <p className="mt-4 text-xl leading-9">{action.action_text}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <form action={completeMicroAction}>
          <input type="hidden" name="microActionId" value={action.id} />
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            Finish this micro-task
          </button>
        </form>
        <form action={swapMicroTask}>
          <input type="hidden" name="microActionId" value={action.id} />
          <input type="hidden" name="taskId" value={taskId} />
          <button
            type="submit"
            className="w-full rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
          >
            Swap micro-task
          </button>
        </form>
      </div>
    </div>
  );
}

function AdditionalMicroTasks({
  actions
}: {
  actions: MicroAction[];
}) {
  const secondaryPending = actions.filter((action) => action.status === "pending").slice(1);
  const completed = actions.filter((action) => action.status === "done");

  if (secondaryPending.length === 0 && completed.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {secondaryPending.map((action) => (
        <div
          key={action.id}
          className="rounded-[1.5rem] border border-[var(--border)] bg-white/72 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            Up next micro-task
          </p>
          <p className="mt-3 text-sm leading-7">{action.action_text}</p>
        </div>
      ))}

      {completed.map((action) => (
        <div
          key={action.id}
          className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(255,255,255,0.65)] p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Cleared
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{action.action_text}</p>
        </div>
      ))}
    </div>
  );
}

function DailyTaskCard({ task, label }: { task: TaskWithRelations; label: string }) {
  const activePlan =
    task.plans.find((plan) => plan.status === "active") ?? task.plans[0] ?? null;
  const actions = activePlan?.micro_actions.length ? activePlan.micro_actions : task.micro_actions;
  const currentMicroTask = actions.find((action) => action.status === "pending") ?? null;
  const completedCount = actions.filter((action) => action.status === "done").length;
  const totalCount = Math.max(actions.length, 1);
  const canComplete = currentMicroTask === null;

  return (
    <article className="surface rounded-[2.2rem] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-[rgba(31,20,11,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {label}
          </span>
          <h3 className="mt-3 text-3xl font-semibold leading-tight">{task.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
            <span>{task.goal_title ?? "Big goal not set"}</span>
            <span>{formatDate(task.deadline)}</span>
            <span>{daysRemainingLabel(task.deadline)}</span>
            <span>{formatDurationMinutes(task.available_time_minutes) ?? "No estimate"}</span>
          </div>
        </div>

        <div className="quest-reward-box w-full max-w-sm rounded-[1.7rem] border border-[var(--border)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Reward
          </p>
          <p className="mt-3 text-xl font-semibold">{task.reward ?? "Pick a reward next time."}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            This is the positive payoff your brain is working toward.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.7rem] border border-[var(--border)] bg-white/72 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Current focus
          </p>
          <p className="mt-3 text-2xl font-semibold">{activePlan?.title ?? task.title}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Keep this broad. The micro-task below is the psychologically smaller entry point.
          </p>
        </div>

        <form action={updateTaskAvailableTime} className="rounded-[1.7rem] border border-[var(--border)] bg-white/72 p-5">
          <input type="hidden" name="taskId" value={task.id} />
          <label
            htmlFor={`availableTime-${task.id}`}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]"
          >
            Estimated prep time
          </label>
          <input
            id={`availableTime-${task.id}`}
            name="availableTime"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={task.available_time_minutes ?? 25}
            className="field mt-3"
            required
          />
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Type whatever fits, including long sessions like 180 or 300 minutes.
          </p>
          <button
            type="submit"
            className="mt-4 w-full rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
          >
            Update time
          </button>
        </form>
      </div>

      <div className="mt-4">
        <ProgressBar completedCount={completedCount} totalCount={totalCount} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <MicroTaskCard action={currentMicroTask} taskId={task.id} />

        <div className="rounded-[1.7rem] border border-[var(--border)] bg-[rgba(255,248,219,0.72)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Finish line
          </p>
          <h4 className="mt-3 text-2xl font-semibold">Close the daily task</h4>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Once all micro-tasks are cleared, move this card into your completed collection.
          </p>
          <form action={completeTask} className="mt-6">
            <input type="hidden" name="taskId" value={task.id} />
            <button
              type="submit"
              disabled={!canComplete}
              className="w-full rounded-full border border-[var(--foreground)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Mark daily task done
            </button>
          </form>
        </div>
      </div>

      <div className="mt-5">
        <AdditionalMicroTasks actions={actions} />
      </div>
    </article>
  );
}

function CompletedCollection({ tasks }: { tasks: TaskWithRelations[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-white/60 p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Completed collection
        </p>
        <h3 className="mt-2 text-2xl font-semibold">Tasks you already cleared</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-[1.6rem] border border-[var(--border)] bg-[rgba(255,255,255,0.8)] p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold">{task.title}</p>
              <span className="rounded-full bg-[rgba(15,118,110,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
                Completed
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {task.goal_title ?? "Big goal not set"} · {formatDate(task.deadline)}
            </p>
            {task.reward ? (
              <p className="mt-3 text-sm leading-6">
                Reward: <span className="font-medium">{task.reward}</span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TaskList({
  tasks,
  completedTasks,
  hasActiveGoals
}: {
  tasks: TaskWithRelations[];
  completedTasks: TaskWithRelations[];
  hasActiveGoals: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.55)] px-6 py-10 text-center">
          <p className="text-lg font-semibold">
            {hasActiveGoals ? "No daily task yet." : "Set a big goal first."}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {hasActiveGoals
              ? "Add one daily task and Ignit will generate one or two psychologically small micro-tasks."
              : "Use onboarding to define the long-term goal that sits above your daily task cards."}
          </p>
        </div>
        <CompletedCollection tasks={completedTasks} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tasks.map((task, index) => (
        <DailyTaskCard
          key={task.id}
          task={task}
          label={index === 0 ? "Main daily task" : "Daily task"}
        />
      ))}

      <CompletedCollection tasks={completedTasks} />
    </div>
  );
}
