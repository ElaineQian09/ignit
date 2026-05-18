"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AiUsageLimitError,
  getIpAddressFromHeaders,
  reserveAiUsage
} from "@/lib/ai-usage-guard";
import { getSchedulePreferences } from "@/lib/auth";
import { getAiLimitEnv } from "@/lib/env";
import {
  buildBlockOutcomeMemories,
  buildScheduleAttemptMemories
} from "@/lib/scheduling-memory";
import { insertMemoryLogs } from "@/lib/memory-logs";
import { generateMicroActionPlan } from "@/lib/orchestrator";
import { createClient } from "@/lib/supabase/server";
import { scheduleMicroActions } from "@/lib/scheduler";
import { taskAvailableTimeSchema } from "@/lib/validators";
import type {
  Profile,
  TodayScheduledBlock,
  UserSchedulePreferences,
  WorkStyle
} from "@/types/domain";

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
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => Promise<{
        data: Array<{ id: string }> | null;
        error?: { message: string } | null;
      }>;
    };
  };
};

type GoalRecord = { id: string; title: string };
type TaskRecord = {
  id: string;
  title: string;
  goal_id: string;
  reward?: string | null;
  deadline?: string | null;
  available_time_minutes: number | null;
  status: "active" | "done" | "archived";
  started_at: string | null;
  goals: { title: string } | null;
};
type PlanRecord = {
  id: string;
  task_id: string;
  title: string;
  status: "active" | "queued" | "done" | "archived";
  sort_order: number;
};
type MicroActionRecord = {
  id: string;
  plan_id: string;
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
    deadline: string | null;
    available_time_minutes: number | null;
    goals: { title: string } | null;
  };
};
type ScheduledBlockRecord = {
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
  tasks: {
    id: string;
    title: string;
    deadline: string | null;
    available_time_minutes: number | null;
    user_id: string;
    goal_id: string;
    goals: { title: string } | null;
  } | null;
  micro_actions: {
    id: string;
    plan_id: string;
    action_text: string;
    estimated_minutes: number;
    status: "pending" | "done" | "skipped";
  } | null;
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

async function insertBehaviorMemoryLogs(
  writable: DashboardWriter,
  userId: string,
  entries: Array<{
    event_type:
      | "schedule_success"
      | "schedule_failure"
      | "block_completed"
      | "block_skipped"
      | "block_rescheduled"
      | "block_need_more_time";
    summary: string;
    metadata?: Record<string, unknown>;
  }>
) {
  if (entries.length === 0) {
    return;
  }

  try {
    const headerStore = await headers();
    const { embeddingEstimatedSpendCents } = getAiLimitEnv();
    await reserveAiUsage(writable as never, {
      userId,
      ipAddress: getIpAddressFromHeaders(headerStore),
      routeKey: "dashboard_memory_logs",
      requestCount: entries.length,
      estimatedSpendCents: embeddingEstimatedSpendCents * entries.length
    });
  } catch (error) {
    if (error instanceof AiUsageLimitError) {
      return;
    }

    console.error("Unable to verify AI usage limits for memory logs:", error);
    return;
  }

  await insertMemoryLogs(
    writable,
    entries.map((entry) => ({
      user_id: userId,
      event_type: entry.event_type,
      summary: entry.summary,
      metadata: entry.metadata ?? null
    }))
  );
}

function getBlockDurationMinutes(block: Pick<ScheduledBlockRecord, "start_time" | "end_time">) {
  return Math.max(
    5,
    Math.round(
      (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000
    )
  );
}

function toTodayScheduledBlock(block: ScheduledBlockRecord): TodayScheduledBlock {
  return {
    id: block.id,
    user_id: block.user_id,
    task_id: block.task_id,
    micro_action_id: block.micro_action_id,
    start_time: block.start_time,
    end_time: block.end_time,
    status: block.status,
    schedule_reason: block.schedule_reason,
    rescheduled_from_block_id: block.rescheduled_from_block_id,
    created_at: "",
    updated_at: "",
    task_title: block.tasks?.title ?? null,
    goal_title: block.tasks?.goals?.title ?? null,
    action_text: block.micro_actions?.action_text ?? null,
    estimated_minutes: block.micro_actions?.estimated_minutes ?? null,
    micro_action_status: block.micro_actions?.status ?? null
  };
}

async function getWorkStyleForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("work_style")
    .eq("user_id", userId)
    .maybeSingle();

  return ((data as Pick<Profile, "work_style"> | null)?.work_style as
    | WorkStyle
    | null
    | undefined) ?? null;
}

async function schedulePlanMicroActions({
  supabase,
  writable,
  userId,
  task,
  plan,
  preferences,
  workStyle,
  searchStartTime
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  writable: DashboardWriter;
  userId: string;
  task: Pick<TaskRecord, "id" | "title" | "deadline" | "available_time_minutes">;
  plan: Pick<PlanRecord, "id" | "title">;
  preferences: UserSchedulePreferences | null;
  workStyle: WorkStyle | null;
  searchStartTime?: string;
}) {
  if (!preferences) {
    return { status: "missing_preferences" as const, scheduledCount: 0 };
  }

  const { data: microActionData } = await supabase
    .from("micro_actions")
    .select("id, action_text, estimated_minutes")
    .eq("plan_id", plan.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const microActions =
    (microActionData ?? []) as Array<{
      id: string;
      action_text: string;
      estimated_minutes: number;
    }>;

  if (microActions.length === 0) {
    return { status: "empty" as const, scheduledCount: 0 };
  }

  const { data: existingBlockData } = await supabase
    .from("scheduled_blocks")
    .select("start_time, end_time, status")
    .eq("user_id", userId)
    .in("status", ["scheduled", "in_progress"]);
  const existingBlocks =
    (existingBlockData ?? []) as Array<{
      start_time: string;
      end_time: string;
      status: string | null;
    }>;

  const scheduled = scheduleMicroActions({
    userPreferences: preferences,
    taskDeadline: task.deadline ?? null,
    availableTimeToday:
      task.available_time_minutes ??
      preferences.preferred_session_minutes ??
      preferences.max_daily_focus_minutes ??
      15,
    microActions,
    energyLevel: "medium",
    workStyle,
    existingBlocks,
    searchStartTime: searchStartTime ?? new Date().toISOString()
  });

  await insertBehaviorMemoryLogs(
    writable,
    userId,
    buildScheduleAttemptMemories({
      scheduledBlocks: scheduled,
      microActions,
      availableTimeToday:
        task.available_time_minutes ??
        preferences.preferred_session_minutes ??
        preferences.max_daily_focus_minutes ??
        15,
      energyLevel: "medium",
      workStyle
    })
  );

  if (scheduled.length === 0) {
    return { status: "no_safe_slot" as const, scheduledCount: 0 };
  }

  const { error } = await writable.from("scheduled_blocks").insert(
    scheduled.map((block) => ({
      user_id: userId,
      task_id: task.id,
      micro_action_id: block.micro_action_id,
      start_time: block.start_time,
      end_time: block.end_time,
      status: "scheduled" as const,
      schedule_reason: block.schedule_reason,
      rescheduled_from_block_id: null
    }))
  );

  if (error) {
    await insertBehaviorMemoryLogs(writable, userId, [
      {
        event_type: "schedule_failure",
        summary: `Plan "${plan.title}" could not be scheduled after activation.`,
        metadata: {
          task_id: task.id,
          plan_id: plan.id,
          reason: error.message
        }
      }
    ]);
    return { status: "save_failed" as const, scheduledCount: 0 };
  }

  return { status: "scheduled" as const, scheduledCount: scheduled.length };
}

async function advanceTaskPlanProgress({
  supabase,
  writable,
  userId,
  task,
  planId,
  completedAt,
  startedAt
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  writable: DashboardWriter;
  userId: string;
  task: TaskRecord;
  planId: string;
  completedAt: string;
  startedAt: string;
}) {
  const { data: currentPlanData } = await supabase
    .from("plans")
    .select("id, task_id, title, status, sort_order")
    .eq("id", planId)
    .eq("task_id", task.id)
    .maybeSingle();
  const currentPlan = (currentPlanData ?? null) as PlanRecord | null;

  if (!currentPlan) {
    return { taskCompleted: false };
  }

  const { data: remainingPlanActions } = await supabase
    .from("micro_actions")
    .select("id")
    .eq("plan_id", planId)
    .eq("status", "pending");
  const planFinished = (remainingPlanActions ?? []).length === 0;

  if (planFinished && currentPlan.status !== "done") {
    await writable
      .from("plans")
      .update({ status: "done" })
      .eq("id", currentPlan.id)
      .eq("task_id", task.id);

    await insertTaskHistoryMemory(
      writable,
      userId,
      `Plan completed: ${currentPlan.title}. Task: ${task.title}.`,
      {
        event_type: "plan_completed",
        plan_id: currentPlan.id,
        task_id: task.id,
        plan_title: currentPlan.title,
        task_title: task.title,
        completed_at: completedAt
      }
    );

    const { data: nextPlanData } = await supabase
      .from("plans")
      .select("id, task_id, title, status, sort_order")
      .eq("task_id", task.id)
      .eq("status", "queued")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    const nextPlan = (nextPlanData ?? null) as PlanRecord | null;

    if (nextPlan) {
      await writable
        .from("plans")
        .update({ status: "active" })
        .eq("id", nextPlan.id)
        .eq("task_id", task.id);

      await insertTaskHistoryMemory(
        writable,
        userId,
        `Plan activated: ${nextPlan.title}. Task: ${task.title}.`,
        {
          event_type: "plan_activated",
          plan_id: nextPlan.id,
          task_id: task.id,
          plan_title: nextPlan.title,
          task_title: task.title,
          activated_at: completedAt
        }
      );

      const preferences = await getSchedulePreferences(userId);
      const workStyle = await getWorkStyleForUser(supabase, userId);
      const scheduleResult = await schedulePlanMicroActions({
        supabase,
        writable,
        userId,
        task,
        plan: nextPlan,
        preferences,
        workStyle,
        searchStartTime: completedAt
      });

      if (scheduleResult.status === "scheduled") {
        await insertTaskHistoryMemory(
          writable,
          userId,
          `Plan scheduled: ${nextPlan.title}. Task: ${task.title}. ${scheduleResult.scheduledCount} block(s) created.`,
          {
            event_type: "plan_scheduled",
            plan_id: nextPlan.id,
            task_id: task.id,
            scheduled_count: scheduleResult.scheduledCount
          }
        );
      }
    }
  }

  const { data: remainingTaskActions } = await supabase
    .from("micro_actions")
    .select("id")
    .eq("task_id", task.id)
    .eq("status", "pending");
  const taskCompleted = (remainingTaskActions ?? []).length === 0;

  if (taskCompleted) {
    await writable
      .from("tasks")
      .update({
        status: "done",
        completed_at: completedAt,
        started_at: startedAt
      })
      .eq("id", task.id)
      .eq("user_id", userId);

    await insertTaskHistoryMemory(
      writable,
      userId,
      `Task completed through plan progress: ${task.title}. Goal: ${task.goals?.title ?? "Unknown"}. Completed at ${completedAt}.`,
      {
        event_type: "task_completed",
        task_id: task.id,
        goal_id: task.goal_id,
        completed_at: completedAt,
        task_title: task.title,
        goal_title: task.goals?.title ?? null,
        completion_source: "all_plans_done"
      }
    );
  }

  return { taskCompleted };
}

async function rescheduleScheduledBlockInternal({
  supabase,
  writable,
  userId,
  block,
  preferences,
  workStyle,
  eventType,
  nextStatus
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  writable: DashboardWriter;
  userId: string;
  block: ScheduledBlockRecord;
  preferences: UserSchedulePreferences;
  workStyle: WorkStyle | null;
  eventType: "block_skipped" | "block_need_more_time" | "block_rescheduled";
  nextStatus: "skipped" | "rescheduled";
}) {
  if (!block.micro_actions || !block.tasks || !block.micro_action_id) {
    dashboardRedirect("Scheduled block is missing its task context.", "error");
  }

  const { data: futureBlocksData } = await supabase
    .from("scheduled_blocks")
    .select("start_time, end_time, status")
    .eq("user_id", userId)
    .gte("end_time", new Date(block.end_time).toISOString());
  const futureBlocks =
    ((futureBlocksData ?? []) as Array<{
      start_time: string;
      end_time: string;
      status: string;
    }>).filter(
      (futureBlock) =>
        futureBlock.status === "scheduled" || futureBlock.status === "in_progress"
    );
  const originalMinutes = getBlockDurationMinutes(block);
  const rescheduleMinutes =
    eventType === "block_need_more_time"
      ? Math.min(
          Math.max(10, Math.round(originalMinutes * 0.75)),
          preferences.preferred_session_minutes ?? originalMinutes
        )
      : Math.min(
          originalMinutes,
          preferences.preferred_session_minutes ?? originalMinutes,
          15
        );
  const scheduled = scheduleMicroActions({
    userPreferences: preferences,
    taskDeadline: block.tasks.deadline,
    availableTimeToday:
      block.tasks.available_time_minutes ??
      preferences.preferred_session_minutes ??
      preferences.max_daily_focus_minutes ??
      rescheduleMinutes,
    microActions: [
      {
        id: block.micro_actions.id,
        action_text: block.micro_actions.action_text,
        estimated_minutes: rescheduleMinutes
      }
    ],
    energyLevel:
      eventType === "block_skipped" && new Date(block.start_time).getHours() >= 22
        ? "low"
        : "medium",
    workStyle,
    existingBlocks: futureBlocks,
    searchStartTime: block.end_time
  });

  if (scheduled.length === 0) {
    await insertBehaviorMemoryLogs(writable, userId, [
      {
        event_type: "schedule_failure",
        summary:
          "User needed a reschedule, but there was no safe next slot within current capacity.",
        metadata: {
          block_id: block.id,
          task_id: block.task_id,
          micro_action_id: block.micro_action_id,
          event_type: eventType
        }
      }
    ]);
    dashboardRedirect("No safe follow-up slot was available.", "error");
  }

  const nextBlock = scheduled[0];

  const { error: updateError } = await writable
    .from("scheduled_blocks")
    .update({
      status: nextStatus
    })
    .eq("id", block.id)
    .eq("user_id", userId);

  if (updateError) {
    dashboardRedirect("Unable to update the current block.", "error");
  }

  const { error: insertError } = await writable.from("scheduled_blocks").insert({
    user_id: userId,
    task_id: block.task_id,
    micro_action_id: block.micro_action_id,
    start_time: nextBlock.start_time,
    end_time: nextBlock.end_time,
    status: "scheduled",
    schedule_reason: nextBlock.schedule_reason,
    rescheduled_from_block_id: block.id
  });

  if (insertError) {
    dashboardRedirect("Unable to create the rescheduled block.", "error");
  }

  await insertBehaviorMemoryLogs(
    writable,
    userId,
    buildBlockOutcomeMemories({
      eventType,
      block: toTodayScheduledBlock(block),
      taskTitle: block.tasks.title,
      actionText: block.micro_actions.action_text,
      workStyle
    })
  );

  return nextBlock;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateTaskAvailableTime(formData: FormData) {
  const parsed = taskAvailableTimeSchema.safeParse({
    taskId: formData.get("taskId"),
    availableTime: formData.get("availableTime")
  });

  if (!parsed.success) {
    dashboardRedirect("Invalid task time.", "error");
  }

  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;

  const { data } = await supabase
    .from("tasks")
    .select("id, title, goal_id, available_time_minutes, status, started_at, goals(title)")
    .eq("id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  const taskRow = (data ?? null) as TaskRecord | null;

  if (!taskRow) {
    dashboardRedirect("Task not found.", "error");
  }

  const { error } = await writable
    .from("tasks")
    .update({ available_time_minutes: parsed.data.availableTime })
    .eq("id", taskRow.id)
    .eq("user_id", user.id);

  if (error) {
    dashboardRedirect("Unable to update task time.", "error");
  }

  await insertTaskHistoryMemory(
    writable,
    user.id,
    `Task estimated time updated: ${taskRow.title}. New available time: ${parsed.data.availableTime} minutes.`,
    {
      event_type: "task_session_time_updated",
      task_id: taskRow.id,
      goal_id: taskRow.goal_id,
      available_time_minutes: parsed.data.availableTime
    }
  );

  revalidatePath("/dashboard");
  dashboardRedirect("Task time updated.", "success");
}

export async function swapMicroTask(formData: FormData) {
  const microActionId = getFormString(formData, "microActionId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;

  const { data: microActionData } = await supabase
    .from("micro_actions")
    .select(
      "id, plan_id, action_text, estimated_minutes, status, task_id, tasks!inner(id, title, goal_id, deadline, available_time_minutes, user_id, goals(title))"
    )
    .eq("id", microActionId)
    .eq("tasks.user_id", user.id)
    .maybeSingle();
  const microAction = (microActionData ?? null) as (MicroActionRecord & {
    estimated_minutes: number;
  }) | null;

  if (!microAction) {
    dashboardRedirect("Micro-task not found.", "error");
  }

  if (microAction.status !== "pending") {
    dashboardRedirect("Only pending micro-tasks can be replaced.", "error");
  }

  const preferences = await getSchedulePreferences(user.id);
  const workStyle = await getWorkStyleForUser(supabase, user.id);
  const headerStore = await headers();
  const { generationEstimatedSpendCents } = getAiLimitEnv();
  try {
    await reserveAiUsage(supabase as never, {
      userId: user.id,
      ipAddress: getIpAddressFromHeaders(headerStore),
      routeKey: "dashboard_swap_micro_task",
      estimatedSpendCents: generationEstimatedSpendCents
    });
  } catch (error) {
    if (error instanceof AiUsageLimitError) {
      dashboardRedirect(error.message, "error");
    }

    dashboardRedirect("Unable to verify AI usage limits.", "error");
  }

  const regenerated = await generateMicroActionPlan({
    userId: user.id,
    task: microAction.tasks.title,
    taskId: microAction.tasks.id,
    planId: microAction.plan_id,
    triggerSource: "manual_replan",
    avoidMicroAction: microAction.action_text,
    energyLevel: "medium",
    userPreferences: {
      preferred_days: preferences?.preferred_days ?? [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      preferred_start_time: preferences?.preferred_start_time ?? "09:00",
      preferred_end_time: preferences?.preferred_end_time ?? "17:00",
      max_daily_focus_minutes: preferences?.max_daily_focus_minutes ?? 60,
      preferred_session_minutes: preferences?.preferred_session_minutes ?? 25,
      break_minutes: preferences?.break_minutes ?? 5,
      high_energy_periods: preferences?.high_energy_periods ?? [],
      low_energy_periods: preferences?.low_energy_periods ?? []
    },
    taskDeadline: microAction.tasks.deadline,
    availableTimeToday: microAction.tasks.available_time_minutes ?? 25,
    workStyle
  });

  const { error } = await writable
    .from("micro_actions")
    .update({
      action_text: regenerated.micro_action,
      estimated_minutes: regenerated.estimated_minutes,
      started_at: null
    })
    .eq("id", microAction.id)
    .eq("task_id", microAction.task_id);

  if (error) {
    dashboardRedirect("Unable to replace this micro-task.", "error");
  }

  await insertTaskHistoryMemory(
    writable,
    user.id,
    `Micro-task replaced: ${microAction.tasks.title}. Previous: ${microAction.action_text}. New: ${regenerated.micro_action}.`,
    {
      event_type: "micro_action_replaced",
      task_id: microAction.tasks.id,
      goal_id: microAction.tasks.goal_id,
      micro_action_id: microAction.id,
      previous_action_text: microAction.action_text,
      new_action_text: regenerated.micro_action
    }
  );

  revalidatePath("/dashboard");
  dashboardRedirect("Micro-task replaced.", "success");
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
    .select("id, plan_id, action_text, status, started_at, task_id, tasks!inner(id, title, goal_id, deadline, available_time_minutes, user_id, goals(title))")
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

  await writable
    .from("scheduled_blocks")
    .update({ status: "in_progress" })
    .eq("micro_action_id", microAction.id)
    .eq("user_id", user.id);

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
    .select("id, plan_id, action_text, estimated_minutes, status, started_at, task_id, tasks!inner(id, title, goal_id, deadline, available_time_minutes, user_id, goals(title))")
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

  await writable
    .from("scheduled_blocks")
    .update({ status: "completed" })
    .eq("micro_action_id", microAction.id)
    .eq("user_id", user.id);
  const workStyle = await getWorkStyleForUser(supabase, user.id);
  await insertBehaviorMemoryLogs(
    writable,
    user.id,
    buildBlockOutcomeMemories({
      eventType: "block_completed",
      block: {
        start_time: startedAt,
        end_time: completedAt,
        schedule_reason: null
      },
      taskTitle: microAction.tasks.title,
      actionText: microAction.action_text,
      workStyle
    })
  );

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

  await advanceTaskPlanProgress({
    supabase,
    writable,
    userId: user.id,
    task: {
      id: microAction.tasks.id,
      title: microAction.tasks.title,
      goal_id: microAction.tasks.goal_id,
      available_time_minutes: microAction.tasks.available_time_minutes,
      deadline: microAction.tasks.deadline,
      status: "active",
      started_at: startedAt,
      goals: microAction.tasks.goals
    },
    planId: microAction.plan_id,
    completedAt,
    startedAt
  });

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
    .select("id, title, goal_id, deadline, available_time_minutes, status, started_at, goals(title)")
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

  await writable
    .from("plans")
    .update({ status: "done" })
    .eq("task_id", taskRow.id)
    .eq("status", "active");

  await writable
    .from("plans")
    .update({ status: "done" })
    .eq("task_id", taskRow.id)
    .eq("status", "queued");

  const { data: scheduledBlockRows } = await writable
    .from("scheduled_blocks")
    .select("id")
    .eq("task_id", taskRow.id);

  if ((scheduledBlockRows ?? []).length > 0) {
    await writable
      .from("scheduled_blocks")
      .update({
        status: "completed"
      })
      .eq("task_id", taskRow.id)
      .eq("user_id", user.id);
  }

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

export async function completeScheduledBlock(formData: FormData) {
  const blockId = getFormString(formData, "blockId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const completedAt = new Date().toISOString();

  const { data } = await supabase
    .from("scheduled_blocks")
    .select(
      "id, user_id, task_id, micro_action_id, start_time, end_time, status, schedule_reason, rescheduled_from_block_id, tasks(id, title, deadline, available_time_minutes, user_id, goal_id, goals(title)), micro_actions(id, plan_id, action_text, estimated_minutes, status)"
    )
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  const block = (data ?? null) as ScheduledBlockRecord | null;

  if (!block || !block.micro_actions || !block.micro_action_id) {
    dashboardRedirect("Scheduled block not found.", "error");
  }

  if (block.micro_actions.status !== "pending") {
    dashboardRedirect("This block's micro-action is already finished.", "error");
  }

  const { error: microActionError } = await writable
    .from("micro_actions")
    .update({
      status: "done",
      started_at: block.start_time,
      completed_at: completedAt
    })
    .eq("id", block.micro_action_id)
    .eq("task_id", block.task_id ?? "");

  if (microActionError) {
    dashboardRedirect("Unable to complete the scheduled block.", "error");
  }

  const { error: blockError } = await writable
    .from("scheduled_blocks")
    .update({
      status: "completed"
    })
    .eq("id", block.id)
    .eq("user_id", user.id);

  if (blockError) {
    dashboardRedirect("Micro-action completed, but block status failed to update.", "error");
  }

  const workStyle = await getWorkStyleForUser(supabase, user.id);
  await insertBehaviorMemoryLogs(
    writable,
    user.id,
    buildBlockOutcomeMemories({
      eventType: "block_completed",
      block: toTodayScheduledBlock(block),
      taskTitle: block.tasks?.title,
      actionText: block.micro_actions.action_text,
      workStyle
    })
  );

  if (block.task_id && block.tasks) {
    await advanceTaskPlanProgress({
      supabase,
      writable,
      userId: user.id,
      task: {
        id: block.tasks.id,
        title: block.tasks.title,
        goal_id: block.tasks.goal_id,
        deadline: block.tasks.deadline,
        available_time_minutes: block.tasks.available_time_minutes,
        status: "active",
        started_at: block.start_time,
        goals: block.tasks.goals
      },
      planId: block.micro_actions.plan_id,
      completedAt,
      startedAt: block.start_time
    });
  }

  revalidatePath("/dashboard");
  dashboardRedirect("Scheduled block completed.", "success");
}

export async function skipScheduledBlock(formData: FormData) {
  const blockId = getFormString(formData, "blockId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const preferences = await getSchedulePreferences(user.id);

  if (!preferences) {
    dashboardRedirect("Set schedule preferences before skipping and rescheduling blocks.", "error");
  }

  const { data } = await supabase
    .from("scheduled_blocks")
    .select(
      "id, user_id, task_id, micro_action_id, start_time, end_time, status, schedule_reason, rescheduled_from_block_id, tasks(id, title, deadline, available_time_minutes, user_id, goal_id, goals(title)), micro_actions(id, plan_id, action_text, estimated_minutes, status)"
    )
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  const block = (data ?? null) as ScheduledBlockRecord | null;

  if (!block) {
    dashboardRedirect("Scheduled block not found.", "error");
  }

  const workStyle = await getWorkStyleForUser(supabase, user.id);
  await rescheduleScheduledBlockInternal({
    supabase,
    writable,
    userId: user.id,
    block,
    preferences,
    workStyle,
    eventType: "block_skipped",
    nextStatus: "skipped"
  });

  revalidatePath("/dashboard");
  dashboardRedirect("Block skipped and moved to the next safe slot.", "success");
}

export async function needMoreTimeForScheduledBlock(formData: FormData) {
  const blockId = getFormString(formData, "blockId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const preferences = await getSchedulePreferences(user.id);

  if (!preferences) {
    dashboardRedirect("Set schedule preferences before extending blocks.", "error");
  }

  const { data } = await supabase
    .from("scheduled_blocks")
    .select(
      "id, user_id, task_id, micro_action_id, start_time, end_time, status, schedule_reason, rescheduled_from_block_id, tasks(id, title, deadline, available_time_minutes, user_id, goal_id, goals(title)), micro_actions(id, plan_id, action_text, estimated_minutes, status)"
    )
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  const block = (data ?? null) as ScheduledBlockRecord | null;

  if (!block) {
    dashboardRedirect("Scheduled block not found.", "error");
  }

  const workStyle = await getWorkStyleForUser(supabase, user.id);
  await rescheduleScheduledBlockInternal({
    supabase,
    writable,
    userId: user.id,
    block,
    preferences,
    workStyle,
    eventType: "block_need_more_time",
    nextStatus: "rescheduled"
  });

  revalidatePath("/dashboard");
  dashboardRedirect("A follow-up block was added.", "success");
}

export async function rescheduleScheduledBlock(formData: FormData) {
  const blockId = getFormString(formData, "blockId");
  const { supabase, user } = await requireDashboardUser();
  const writable = supabase as unknown as DashboardWriter;
  const preferences = await getSchedulePreferences(user.id);

  if (!preferences) {
    dashboardRedirect("Set schedule preferences before rescheduling blocks.", "error");
  }

  const { data } = await supabase
    .from("scheduled_blocks")
    .select(
      "id, user_id, task_id, micro_action_id, start_time, end_time, status, schedule_reason, rescheduled_from_block_id, tasks(id, title, deadline, available_time_minutes, user_id, goal_id, goals(title)), micro_actions(id, plan_id, action_text, estimated_minutes, status)"
    )
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  const block = (data ?? null) as ScheduledBlockRecord | null;

  if (!block) {
    dashboardRedirect("Scheduled block not found.", "error");
  }

  const workStyle = await getWorkStyleForUser(supabase, user.id);
  await rescheduleScheduledBlockInternal({
    supabase,
    writable,
    userId: user.id,
    block,
    preferences,
    workStyle,
    eventType: "block_rescheduled",
    nextStatus: "rescheduled"
  });

  revalidatePath("/dashboard");
  dashboardRedirect("Block moved to the next safe slot.", "success");
}
