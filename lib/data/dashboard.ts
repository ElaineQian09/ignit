import { createClient } from "@/lib/supabase/server";
import { isSameLocalDay } from "@/lib/utils";
import type {
  CompletionStats,
  Goal,
  MicroAction,
  PlanWithRelations,
  TaskWithRelations,
  TodayScheduledBlock
} from "@/types/domain";

interface PlanQueryRow {
  id: string;
  task_id: string;
  title: string;
  status: "active" | "queued" | "done" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
  micro_actions: MicroAction[] | null;
}

interface TaskQueryRow {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  deadline: string | null;
  available_time_minutes: number | null;
  status: "active" | "done" | "archived";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  goals: { title: string } | null;
  plans: PlanQueryRow[] | null;
}

interface ScheduledBlockQueryRow {
  id: string;
  user_id: string;
  task_id: string | null;
  micro_action_id: string | null;
  start_time: string;
  end_time: string;
  status:
    | "scheduled"
    | "in_progress"
    | "completed"
    | "skipped"
    | "rescheduled"
    | "cancelled";
  schedule_reason: string | null;
  rescheduled_from_block_id: string | null;
  created_at: string;
  updated_at: string;
  tasks: { title: string; goals: { title: string } | null } | null;
  micro_actions:
    | {
        id: string;
        action_text: string;
        estimated_minutes: number;
        status: "pending" | "done" | "skipped";
      }
    | null;
}

interface CompletedMicroActionRow {
  id: string;
  completed_at: string | null;
  tasks: { user_id: string } | null;
}

function startOfWeek(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function buildCompletionStats(rows: CompletedMicroActionRow[]): CompletionStats {
  const completedRows = rows.filter(
    (row): row is CompletedMicroActionRow & { completed_at: string } =>
      Boolean(row.completed_at)
  );
  const today = new Date();
  const weekStart = startOfWeek(today);
  const uniqueCompletedDays = Array.from(
    new Set(
      completedRows
        .map((row) => row.completed_at.slice(0, 10))
        .sort((left, right) => right.localeCompare(left))
    )
  );
  let streak = 0;
  const completedDaySet = new Set(uniqueCompletedDays);
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  while (completedDaySet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    current_streak_days: streak,
    completed_micro_actions_today: completedRows.filter((row) =>
      isSameLocalDay(row.completed_at, today)
    ).length,
    completed_micro_actions_this_week: completedRows.filter(
      (row) => new Date(row.completed_at) >= weekStart
    ).length,
    completed_micro_actions_total: completedRows.length
  };
}

export async function getDashboardData(userId: string) {
  const supabase = await createClient();

  const [
    { data: goals },
    { data: tasks },
    { data: scheduledBlocks },
    { data: completedMicroActions }
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, user_id, goal_id, title, deadline, available_time_minutes, status, started_at, completed_at, created_at, updated_at, goals(title), plans(id, task_id, title, status, sort_order, created_at, updated_at, micro_actions(id, task_id, plan_id, action_text, estimated_minutes, status, started_at, completed_at, created_at, updated_at))"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("scheduled_blocks")
      .select(
        "id, user_id, task_id, micro_action_id, start_time, end_time, status, schedule_reason, rescheduled_from_block_id, created_at, updated_at, tasks(title, goals(title)), micro_actions(id, action_text, estimated_minutes, status)"
      )
      .eq("user_id", userId)
      .in("status", ["scheduled", "in_progress", "completed"])
      .order("start_time", { ascending: true }),
    supabase
      .from("micro_actions")
      .select("id, completed_at, tasks!inner(user_id)")
      .eq("status", "done")
      .eq("tasks.user_id", userId)
      .order("created_at", { ascending: false })
  ]);

  const activeGoals = (goals ?? []) as Goal[];
  const activeTasks = ((tasks ?? []) as TaskQueryRow[]).map((task) => {
    const plans = (task.plans ?? [])
      .map((plan) => ({
        ...plan,
        micro_actions: (plan.micro_actions ?? []).sort((left, right) =>
          left.created_at.localeCompare(right.created_at)
        )
      }))
      .sort((left, right) => left.sort_order - right.sort_order) as PlanWithRelations[];

    return {
      id: task.id,
      user_id: task.user_id,
      goal_id: task.goal_id,
      title: task.title,
      deadline: task.deadline,
      available_time_minutes: task.available_time_minutes,
      status: task.status,
      started_at: task.started_at,
      completed_at: task.completed_at,
      created_at: task.created_at,
      updated_at: task.updated_at,
      goal_title: task.goals?.title ?? null,
      plans,
      micro_actions: plans.flatMap((plan) => plan.micro_actions)
    };
  }) satisfies TaskWithRelations[];

  const now = new Date();
  const normalizedBlocks = ((scheduledBlocks ?? []) as ScheduledBlockQueryRow[]).map(
    (block) => ({
      id: block.id,
      user_id: block.user_id,
      task_id: block.task_id,
      micro_action_id: block.micro_action_id,
      start_time: block.start_time,
      end_time: block.end_time,
      status: block.status,
      schedule_reason: block.schedule_reason,
      rescheduled_from_block_id: block.rescheduled_from_block_id,
      created_at: block.created_at,
      updated_at: block.updated_at,
      task_title: block.tasks?.title ?? null,
      goal_title: block.tasks?.goals?.title ?? null,
      action_text: block.micro_actions?.action_text ?? null,
      estimated_minutes: block.micro_actions?.estimated_minutes ?? null,
      micro_action_status: block.micro_actions?.status ?? null
    })
  ) as TodayScheduledBlock[];
  const todaySchedule = normalizedBlocks
    .filter((block) => isSameLocalDay(block.start_time, now))
    .sort((left, right) => left.start_time.localeCompare(right.start_time));
  const upcomingSchedule = normalizedBlocks
    .filter((block) => new Date(block.start_time) > now && !isSameLocalDay(block.start_time, now))
    .slice(0, 6) as TodayScheduledBlock[];
  const completionStats = buildCompletionStats(
    (completedMicroActions ?? []) as CompletedMicroActionRow[]
  );

  return {
    activeGoals,
    activeTasks,
    todaySchedule,
    upcomingSchedule,
    completionStats
  };
}
