"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSchedulePreferences, requireOnboardedUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { generateMicroActionPlan } from "@/lib/orchestrator";
import { splitToList } from "@/lib/utils";
import { taskSchema } from "@/lib/validators";
import type { UserSchedulePreferences, WorkStyle } from "@/types/domain";

function buildPlanTaskPrompt(taskTitle: string, planTitle: string) {
  const normalizedTask = taskTitle.trim();
  const normalizedPlan = planTitle.trim();

  if (!normalizedPlan || normalizedPlan === normalizedTask) {
    return normalizedTask;
  }

  return `${normalizedTask}. Current plan focus: ${normalizedPlan}.`;
}

function buildSecondaryMicroTask(
  optionalNextStep: string,
  fallbackMinutes: number
) {
  const text = optionalNextStep.trim();

  if (!text) {
    return null;
  }

  return {
    action_text: text,
    estimated_minutes: Math.max(3, Math.min(fallbackMinutes + 2, 12))
  };
}

function getPlanningPreferences(
  preferences: UserSchedulePreferences | null
): Pick<
  UserSchedulePreferences,
  | "preferred_days"
  | "preferred_start_time"
  | "preferred_end_time"
  | "max_daily_focus_minutes"
  | "preferred_session_minutes"
  | "break_minutes"
  | "high_energy_periods"
  | "low_energy_periods"
> {
  return {
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
  };
}

export async function createTask(formData: FormData) {
  const parsed = taskSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
    reward: formData.get("reward"),
    planTitles: formData.get("planTitles") || undefined,
    deadline: formData.get("deadline") || undefined,
    availableTime: formData.get("availableTime"),
    energyLevel: formData.get("energyLevel")
  });

  if (!parsed.success) {
    redirect("/task/new?error=Please%20complete%20the%20task%20form.");
  }

  const { supabase, user, profile } = await requireOnboardedUser();
  const requestedPlans = splitToList(parsed.data.planTitles ?? "");
  const planTitles = requestedPlans.length > 0 ? requestedPlans : [parsed.data.title];
  // Supabase SSR currently loses write-table inference here, so keep the cast local.
  const writable = supabase as unknown as {
    from: (table: string) => {
      insert: (values: unknown) => unknown;
    };
  };

  const { data: goalData } = await supabase
    .from("goals")
    .select("id, title")
    .eq("id", parsed.data.goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  const goal = (goalData ?? null) as { id: string; title: string } | null;

  if (!goal) {
    redirect("/task/new?error=Selected%20goal%20was%20not%20found.");
  }

  const schedulePreferences = await getSchedulePreferences(user.id);
  const planningPreferences = getPlanningPreferences(schedulePreferences);
  const workStyle = (profile.work_style as WorkStyle | null | undefined) ?? null;

  const taskInsert = writable.from("tasks").insert({
    user_id: user.id,
    goal_id: goal.id,
    title: parsed.data.title,
    reward: parsed.data.reward,
    deadline: parsed.data.deadline || null,
    available_time_minutes: parsed.data.availableTime,
    status: "active"
  }) as {
    select: (
      columns: string
    ) => {
      single: () => Promise<{
        data: { id: string } | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: task, error: taskError } = await taskInsert
    .select("id")
    .single();

  if (taskError || !task) {
    redirect("/task/new?error=Unable%20to%20create%20task.");
  }

  const planInsert = writable.from("plans").insert(
    planTitles.map((title, index) => ({
      task_id: task.id,
      title,
      status: index === 0 ? "active" as const : "queued" as const,
      sort_order: index
    }))
  ) as {
    select: (
      columns: string
    ) => Promise<{
      data:
        | Array<{
            id: string;
            title: string;
            status: "active" | "queued" | "done" | "archived";
            sort_order: number;
          }>
        | null;
      error: { message: string } | null;
    }>;
  };

  const { data: insertedPlans, error: planError } =
    await planInsert.select("id, title, status, sort_order");

  if (planError || !insertedPlans || insertedPlans.length === 0) {
    redirect("/task/new?error=Task%20created,%20but%20plans%20failed.");
  }

  const generatedPlans = await Promise.all(
    insertedPlans
      .sort((left, right) => left.sort_order - right.sort_order)
      .map(async (plan) => ({
        plan,
        microActionPlan: await generateMicroActionPlan({
          userId: user.id,
          task: buildPlanTaskPrompt(parsed.data.title, plan.title),
          taskId: task.id,
          planId: plan.id,
          triggerSource: "task_creation",
          energyLevel: parsed.data.energyLevel,
          userPreferences: planningPreferences,
          taskDeadline: parsed.data.deadline || null,
          availableTimeToday: parsed.data.availableTime,
          workStyle
        })
      }))
  );

  const microActionRows = generatedPlans.flatMap(({ plan, microActionPlan }) => {
    const primary = {
      task_id: task.id,
      plan_id: plan.id,
      action_text: microActionPlan.micro_action,
      estimated_minutes: microActionPlan.estimated_minutes,
      status: "pending" as const
    };
    const secondary =
      parsed.data.availableTime >= 25
        ? buildSecondaryMicroTask(
            microActionPlan.optional_next_step,
            microActionPlan.estimated_minutes
          )
        : null;

    return secondary
      ? [
          primary,
          {
            task_id: task.id,
            plan_id: plan.id,
            action_text: secondary.action_text,
            estimated_minutes: secondary.estimated_minutes,
            status: "pending" as const
          }
        ]
      : [primary];
  });

  const microActionInsert = writable.from("micro_actions").insert(
    microActionRows
  ) as {
    select: (
      columns: string
    ) => Promise<{
      data:
        | Array<{
            id: string;
            plan_id: string;
            action_text: string;
            estimated_minutes: number;
          }>
        | null;
      error: { message: string } | null;
    }>;
  };

  const { data: insertedMicroActions, error: actionError } =
    await microActionInsert.select("id, plan_id, action_text, estimated_minutes");

  if (actionError || !insertedMicroActions || insertedMicroActions.length === 0) {
    redirect("/task/new?error=Task%20created,%20but%20micro-actions%20failed.");
  }
  const activePlanId =
    insertedPlans.find((plan) => plan.status === "active")?.id ?? insertedPlans[0].id;
  const activePlanMicroActions = insertedMicroActions.filter(
    (action) => action.plan_id === activePlanId
  );

  let scheduleWarning: string | null = null;

  if (schedulePreferences && activePlanMicroActions.length > 0) {
    const headerStore = await headers();
    const cookieStore = await cookies();
    const forwardedHost =
      headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const forwardedProto =
      headerStore.get("x-forwarded-proto") ??
      (forwardedHost?.includes("localhost") ? "http" : "https");
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : getBaseUrl();

    try {
      const scheduleResponse = await fetch(`${origin}/api/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookieStore
            .getAll()
            .map(({ name, value }) => `${name}=${value}`)
            .join("; ")
        },
        body: JSON.stringify({
          task_id: task.id,
          micro_actions: activePlanMicroActions,
          deadline: parsed.data.deadline || undefined,
          available_time_today: parsed.data.availableTime,
          energy_level: parsed.data.energyLevel
        }),
        cache: "no-store"
      });

      if (!scheduleResponse.ok) {
        scheduleWarning = "Task%20created,%20but%20schedule%20blocks%20could%20not%20be%20generated.";
      }
    } catch (error) {
      console.error("Automatic scheduling failed:", error);
      scheduleWarning = "Task%20created,%20but%20schedule%20blocks%20could%20not%20be%20generated.";
    }
  } else {
    scheduleWarning =
      "Task%20created,%20but%20schedule%20blocks%20were%20skipped%20until%20schedule%20settings%20are%20configured.";
  }

  await writable.from("memory_chunks").insert({
    user_id: user.id,
    source_type: "task_history",
    content: `Task created: ${parsed.data.title}. Goal: ${goal.title}. Plans: ${planTitles.join(", ")}. Estimated prep time: ${parsed.data.availableTime} minutes. Energy: ${parsed.data.energyLevel}.`,
    metadata: {
      goal_id: goal.id,
      reward: parsed.data.reward,
      deadline: parsed.data.deadline || null,
      available_time_minutes: parsed.data.availableTime,
      plans: planTitles
    }
  });

  revalidatePath("/dashboard");
  if (scheduleWarning) {
    redirect(`/dashboard?success=${scheduleWarning}`);
  }

  redirect("/dashboard?success=Task%20created%20with%20fresh%20micro-actions%20and%20scheduled%20blocks.");
}
