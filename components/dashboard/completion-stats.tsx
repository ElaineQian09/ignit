import type { CompletionStats } from "@/types/domain";

function getFeedbackMessage(stats: CompletionStats) {
  if (stats.completed_micro_actions_today >= 5) {
    return "You already cleared real work today. Keep the streak simple and light.";
  }

  if (stats.completed_micro_actions_today >= 1) {
    return "Momentum is already alive today. Protect it with one more clear step.";
  }

  if (stats.current_streak_days >= 3) {
    return "Your streak is carrying you. The goal today is to avoid breaking the chain.";
  }

  return "A small win today is enough. One finished tile is still forward motion.";
}

export function CompletionStatsCard({
  stats
}: {
  stats: CompletionStats;
}) {
  const items = [
    {
      label: "Cleared today",
      value: String(stats.completed_micro_actions_today)
    },
    {
      label: "Current streak",
      value: `${stats.current_streak_days}d`
    },
    {
      label: "Tasks beaten",
      value: String(stats.completed_tasks_total)
    },
    {
      label: "All-time tiles",
      value: String(stats.completed_micro_actions_total)
    }
  ];

  return (
    <section className="progress-banner rounded-[2.4rem] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            Progress first
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {stats.completed_micro_actions_today} tiles cleared today
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {getFeedbackMessage(stats)}
          </p>
        </div>

        <div className="grid min-w-full gap-3 sm:grid-cols-2 lg:min-w-[30rem] lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.4rem] border border-[rgba(88,61,37,0.12)] bg-white/78 px-4 py-4 shadow-[0_14px_30px_rgba(72,44,18,0.08)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
