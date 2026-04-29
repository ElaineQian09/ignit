"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardedUser } from "@/lib/auth";
import { generateMicroActions } from "@/lib/planner";
import { taskSchema } from "@/lib/validators";

export async function createTask(formData: FormData) {
  const parsed = taskSchema.safeParse({
    goalId: formData.get("goalId"),
    title: formData.get("title"),
    deadline: formData.get("deadline") || undefined,
    availableTime: formData.get("availableTime"),
    energyLevel: formData.get("energyLevel")
  });

  if (!parsed.success) {
    redirect("/task/new?error=Please%20complete%20the%20task%20form.");
  }

  const { supabase, user, profile } = await requireOnboardedUser();
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

  const { data: memoryData } = await supabase
    .from("memory_chunks")
    .select("content")
    .eq("user_id", user.id)
    .eq("source_type", "task_history")
    .order("created_at", { ascending: false })
    .limit(6);
  const behaviorMemory = ((memoryData ?? []) as Array<{ content: string }>).map(
    (item) => item.content
  );

  const taskInsert = writable.from("tasks").insert({
    user_id: user.id,
    goal_id: goal.id,
    title: parsed.data.title,
    deadline: parsed.data.deadline || null,
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

  const microActions = await generateMicroActions({
    taskTitle: parsed.data.title,
    goalTitle: goal.title,
    availableTime: parsed.data.availableTime,
    energyLevel: parsed.data.energyLevel,
    deadline: parsed.data.deadline || null,
    behaviorMemory,
    profile
  });

  const microActionInsert = writable.from("micro_actions").insert(
    microActions.map((action) => ({
      task_id: task.id,
      action_text: action.action_text,
      estimated_minutes: action.estimated_minutes,
      status: "pending" as const
    }))
  ) as Promise<{ error: { message: string } | null }>;

  const { error: actionError } = await microActionInsert;

  if (actionError) {
    redirect("/task/new?error=Task%20created,%20but%20micro-actions%20failed.");
  }

  await writable.from("memory_chunks").insert({
    user_id: user.id,
    source_type: "task_history",
    content: `Task created: ${parsed.data.title}. Goal: ${goal.title}. Available time: ${parsed.data.availableTime} minutes. Energy: ${parsed.data.energyLevel}.`,
    metadata: {
      goal_id: goal.id,
      deadline: parsed.data.deadline || null
    }
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?success=Task%20created%20with%20fresh%20micro-actions.");
}
