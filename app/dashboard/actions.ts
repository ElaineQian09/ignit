"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type DashboardWriter = {
  from: (table: string) => {
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          nestedColumn: string,
          nestedValue: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

type GoalRecord = { id: string; title: string };
type TaskRecord = {
  id: string;
  title: string;
  goal_id: string;
  status: "active" | "done" | "archived";
  started_at: string | null;
  goals: { title: string } | null;
};
type MicroActionRecord = {
  id: string;
  action_text: string;
  estimated_minutes?: number;
  status: "pending" | "done" | "skipped";
  started_at: string | null;
  task_id: string;
  tasks: {
    id: string;
    title: string;
    goal_id: string;
    user_id: string;
    goals: { title: string } | null;
  };
};

function dashboardRedirect(message: string, tone: "success" | "error"): never {
  const key = tone === "success" ? "success" : "error";
  redirect(`/dashboard?${key}=${encodeURIComponent(message)}`);
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.length === 0) {
    dashboardRedirect(`${key} not found.`, "error");
  }

  return value;
}

async function requireDashboardUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function insertTaskHistoryMemory(
  writable: DashboardWriter,
  userId: string,
  content: string,
  metadata: Record<string, unknown>
) {
  await writable.from("memory_chunks").insert({
    user_id: userId,
    source_type: "task_history",
    content,
    metadata
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function pauseGoal(formData: FormData) {
  const goalId = getFormString(formData, "goalId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;

  const { data } = await supabase
    .from("goals")
    .select("id, title")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  const goal = (data ?? null) as GoalRecord | null;

  if (!goal) {
    dashboardRedirect("Goal not found.", "error");
  }

  const { error: goalError } = await writable
    .from("goals")
    .update({ status: "paused" })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (goalError) {
    dashboardRedirect("Unable to pause goal.", "error");
  }

  const { error: taskError } = await writable
    .from("tasks")
    .update({ status: "archived" })
    .eq("goal_id", goalId)
    .eq("user_id", user.id);

  if (taskError) {
    dashboardRedirect("Goal paused, but tasks could not be archived.", "error");
  }

  await insertTaskHistoryMemory(writable, user.id, `Goal paused: ${goal.title}.`, {
    event_type: "goal_paused",
    goal_id: goal.id,
    goal_title: goal.title,
    occurred_at: new Date().toISOString()
  });

  revalidatePath("/dashboard");
  dashboardRedirect("Goal paused.", "success");
}

export async function startMicroAction(formData: FormData) {
  const microActionId = getFormString(formData, "microActionId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const startedAt = new Date().toISOString();

  const { data } = await supabase
    .from("micro_actions")
    .select("id, action_text, status, started_at, task_id, tasks!inner(id, title, goal_id, user_id, goals(title))")
    .eq("id", microActionId)
    .eq("tasks.user_id", user.id)
    .maybeSingle();
  const microAction = (data ?? null) as MicroActionRecord | null;

  if (!microAction) {
    dashboardRedirect("Micro-action not found.", "error");
  }

  if (microAction.status !== "pending") {
    dashboardRedirect("This micro-action is no longer active.", "error");
  }

  if (!microAction.started_at) {
    const { error } = await writable
      .from("micro_actions")
      .update({ started_at: startedAt })
      .eq("id", microAction.id)
      .eq("task_id", microAction.task_id);

    if (error) {
      dashboardRedirect("Unable to start micro-action.", "error");
    }
  }

  const { data: taskData } = await supabase
    .from("tasks")
    .select("id, started_at")
    .eq("id", microAction.task_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const taskRow = (taskData ?? null) as { id: string; started_at: string | null } | null;

  if (taskRow && !taskRow.started_at) {
    await writable
      .from("tasks")
      .update({ started_at: startedAt })
      .eq("id", taskRow.id)
      .eq("user_id", user.id);
  }

  await insertTaskHistoryMemory(
    writable,
    user.id,
    `Started micro-action: ${microAction.action_text}. Task: ${microAction.tasks.title}. Goal: ${microAction.tasks.goals?.title ?? "Unknown"}. Started at ${startedAt}.`,
    {
      event_type: "micro_action_started",
      micro_action_id: microAction.id,
      task_id: microAction.tasks.id,
      goal_id: microAction.tasks.goal_id,
      started_at: startedAt,
      action_text: microAction.action_text,
      task_title: microAction.tasks.title,
      goal_title: microAction.tasks.goals?.title ?? null
    }
  );

  revalidatePath("/dashboard");
  dashboardRedirect("Work started.", "success");
}

export async function completeMicroAction(formData: FormData) {
  const microActionId = getFormString(formData, "microActionId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const completedAt = new Date().toISOString();

  const { data } = await supabase
    .from("micro_actions")
    .select("id, action_text, estimated_minutes, status, started_at, task_id, tasks!inner(id, title, goal_id, user_id, goals(title))")
    .eq("id", microActionId)
    .eq("tasks.user_id", user.id)
    .maybeSingle();
  const microAction = (data ?? null) as MicroActionRecord | null;

  if (!microAction) {
    dashboardRedirect("Micro-action not found.", "error");
  }

  if (microAction.status !== "pending") {
    dashboardRedirect("This micro-action was already completed.", "error");
  }

  const startedAt = microAction.started_at ?? completedAt;
  const { error: completeError } = await writable
    .from("micro_actions")
    .update({
      status: "done",
      started_at: startedAt,
      completed_at: completedAt
    })
    .eq("id", microAction.id)
    .eq("task_id", microAction.task_id);

  if (completeError) {
    dashboardRedirect("Unable to complete micro-action.", "error");
  }

  await insertTaskHistoryMemory(
    writable,
    user.id,
    `Completed micro-action: ${microAction.action_text}. Task: ${microAction.tasks.title}. Goal: ${microAction.tasks.goals?.title ?? "Unknown"}. Started at ${startedAt}. Completed at ${completedAt}.`,
    {
      event_type: "micro_action_completed",
      micro_action_id: microAction.id,
      task_id: microAction.tasks.id,
      goal_id: microAction.tasks.goal_id,
      started_at: startedAt,
      completed_at: completedAt,
      estimated_minutes: microAction.estimated_minutes ?? null,
      action_text: microAction.action_text,
      task_title: microAction.tasks.title,
      goal_title: microAction.tasks.goals?.title ?? null
    }
  );

  const { data: remainingPending } = await supabase
    .from("micro_actions")
    .select("id")
    .eq("task_id", microAction.task_id)
    .eq("status", "pending");

  if ((remainingPending ?? []).length === 0) {
    await writable
      .from("tasks")
      .update({
        status: "done",
        completed_at: completedAt,
        started_at: startedAt
      })
      .eq("id", microAction.task_id)
      .eq("user_id", user.id);

    await insertTaskHistoryMemory(
      writable,
      user.id,
      `Task completed through micro-actions: ${microAction.tasks.title}. Goal: ${microAction.tasks.goals?.title ?? "Unknown"}. Completed at ${completedAt}.`,
      {
        event_type: "task_completed",
        task_id: microAction.tasks.id,
        goal_id: microAction.tasks.goal_id,
        completed_at: completedAt,
        task_title: microAction.tasks.title,
        goal_title: microAction.tasks.goals?.title ?? null,
        completion_source: "all_micro_actions_done"
      }
    );
  }

  revalidatePath("/dashboard");
  dashboardRedirect("Micro-action completed.", "success");
}

export async function completeTask(formData: FormData) {
  const taskId = getFormString(formData, "taskId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const completedAt = new Date().toISOString();

  const { data } = await supabase
    .from("tasks")
    .select("id, title, goal_id, status, started_at, goals(title)")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  const taskRow = (data ?? null) as TaskRecord | null;

  if (!taskRow) {
    dashboardRedirect("Task not found.", "error");
  }

  if (taskRow.status !== "active") {
    dashboardRedirect("This task is no longer active.", "error");
  }

  const startedAt = taskRow.started_at ?? completedAt;
  const { error: taskError } = await writable
    .from("tasks")
    .update({
      status: "done",
      started_at: startedAt,
      completed_at: completedAt
    })
    .eq("id", taskRow.id)
    .eq("user_id", user.id);

  if (taskError) {
    dashboardRedirect("Unable to complete task.", "error");
  }

  await writable
    .from("micro_actions")
    .update({
      status: "done",
      completed_at: completedAt
    })
    .eq("task_id", taskRow.id)
    .eq("status", "pending");

  await insertTaskHistoryMemory(
    writable,
    user.id,
    `Task completed manually: ${taskRow.title}. Goal: ${taskRow.goals?.title ?? "Unknown"}. Started at ${startedAt}. Completed at ${completedAt}.`,
    {
      event_type: "task_completed",
      task_id: taskRow.id,
      goal_id: taskRow.goal_id,
      started_at: startedAt,
      completed_at: completedAt,
      task_title: taskRow.title,
      goal_title: taskRow.goals?.title ?? null,
      completion_source: "manual_task_completion"
    }
  );

  revalidatePath("/dashboard");
  dashboardRedirect("Task completed.", "success");
}
