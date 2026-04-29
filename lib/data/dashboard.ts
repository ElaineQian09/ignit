import { createClient } from "@/lib/supabase/server";
import type { DashboardAction, Goal, MicroAction, TaskWithRelations } from "@/types/domain";

interface TaskQueryRow {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  deadline: string | null;
  status: "active" | "done" | "archived";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  goals: { title: string } | null;
  micro_actions: MicroAction[] | null;
}

export async function getDashboardData(userId: string) {
  const supabase = await createClient();

  const [{ data: goals }, { data: tasks }] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, user_id, goal_id, title, deadline, status, started_at, completed_at, created_at, updated_at, goals(title), micro_actions(id, task_id, action_text, estimated_minutes, status, started_at, completed_at, created_at, updated_at)"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
  ]);

  const activeGoals = (goals ?? []) as Goal[];
  const activeTasks = ((tasks ?? []) as TaskQueryRow[]).map((task) => ({
    id: task.id,
    user_id: task.user_id,
    goal_id: task.goal_id,
    title: task.title,
    deadline: task.deadline,
    status: task.status,
    started_at: task.started_at,
    completed_at: task.completed_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
    goal_title: task.goals?.title ?? null,
    micro_actions: task.micro_actions ?? []
  })) satisfies TaskWithRelations[];

  const todayMicroActions = activeTasks
    .flatMap((task) =>
      task.micro_actions
        .filter((action) => action.status === "pending")
        .map((action) => ({
          ...action,
          task_title: task.title,
          goal_title: task.goal_title
        }))
    )
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, 5) as DashboardAction[];

  return {
    activeGoals,
    activeTasks,
    todayMicroActions
  };
}
