import {
  completeScheduledBlock,
  needMoreTimeForScheduledBlock,
  rescheduleScheduledBlock,
  skipScheduledBlock
} from "@/app/dashboard/actions";
import { formatTime } from "@/lib/utils";
import type { TodayScheduledBlock } from "@/types/domain";

function getStatusLabel(block: TodayScheduledBlock) {
  if (block.status === "completed" || block.micro_action_status === "done") {
    return {
      label: "Completed",
      className:
        "bg-[rgba(15,118,110,0.12)] text-[var(--teal)]"
    };
  }

  const now = new Date();
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);

  if (now >= start && now <= end) {
    return {
      label: "Now",
      className:
        "bg-[rgba(235,91,44,0.12)] text-[var(--accent-strong)]"
    };
  }

  if (start > now) {
    return {
      label: "Upcoming",
      className:
        "bg-[rgba(15,23,42,0.06)] text-[var(--foreground)]"
    };
  }

  return {
    label: "Missed",
    className:
      "bg-[rgba(148,163,184,0.18)] text-[var(--muted)]"
  };
}

export function ScheduleBlockList({
  blocks,
  emptyTitle,
  emptyBody
}: {
  blocks: TodayScheduledBlock[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (blocks.length === 0) {
    return (
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>{emptyTitle}</p>
        <p>{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const status = getStatusLabel(block);

        return (
          <div
            key={block.id}
            className="rounded-[1.5rem] border border-[var(--border)] bg-white/75 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {formatTime(block.start_time)} to {formatTime(block.end_time)}
                </p>
                <p className="mt-1 text-base font-medium leading-7">
                  {block.action_text ?? "Scheduled work block"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              {block.estimated_minutes ? (
                <span>{block.estimated_minutes} min</span>
              ) : null}
              {block.goal_title ? <span>{block.goal_title}</span> : null}
              {block.task_title ? <span>{block.task_title}</span> : null}
            </div>

            {block.schedule_reason ? (
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {block.schedule_reason}
              </p>
            ) : null}

            {block.micro_action_status === "pending" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <form action={completeScheduledBlock}>
                  <input type="hidden" name="blockId" value={block.id} />
                  <button
                    type="submit"
                    className="rounded-full bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:opacity-90"
                  >
                    Done
                  </button>
                </form>
                <form action={skipScheduledBlock}>
                  <input type="hidden" name="blockId" value={block.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
                  >
                    Skip
                  </button>
                </form>
                <form action={needMoreTimeForScheduledBlock}>
                  <input type="hidden" name="blockId" value={block.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
                  >
                    Need more time
                  </button>
                </form>
                <form action={rescheduleScheduledBlock}>
                  <input type="hidden" name="blockId" value={block.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.86)]"
                  >
                    Reschedule
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
