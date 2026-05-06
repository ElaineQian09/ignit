import type { CompletionStats } from "@/types/domain";

export function CompletionStatsCard({
  stats
}: {
  stats: CompletionStats;
}) {
  const items = [
    {
      label: "Current streak",
      value: `${stats.current_streak_days} day${stats.current_streak_days === 1 ? "" : "s"}`
    },
    {
      label: "Completed today",
      value: String(stats.completed_micro_actions_today)
    },
    {
      label: "Completed this week",
      value: String(stats.completed_micro_actions_this_week)
    },
    {
      label: "Completed total",
      value: String(stats.completed_micro_actions_total)
    }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[var(--border)] bg-white/75 px-4 py-4"
        >
          <p className="text-sm text-[var(--muted)]">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
