"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { splitToList } from "@/lib/utils";
import { onboardingSchema } from "@/lib/validators";

export async function saveOnboarding(formData: FormData) {
  const parsed = onboardingSchema.safeParse({
    bigGoals: formData.get("bigGoals"),
    preferredWorkHours: formData.get("preferredWorkHours"),
    workStyle: formData.get("workStyle"),
    commonAvoidancePatterns: formData.getAll("commonAvoidancePatterns")
  });

  if (!parsed.success) {
    redirect("/onboarding?error=Please%20complete%20all%20required%20fields.");
  }

  const { supabase, user } = await requireUser();
  const goals = splitToList(parsed.data.bigGoals);
  // Supabase SSR currently loses write-table inference here, so keep the cast local.
  const writable = supabase as unknown as {
    from: (table: string) => {
      update: (values: unknown) => {
        eq: (column: string, value: string) => {
          in: (
            column: string,
            values: string[]
          ) => Promise<{ error: { message: string } | null }>;
          neq: (
            column: string,
            value: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
      upsert: (
        values: unknown,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          order: (
            column: string,
            options?: { ascending?: boolean }
          ) => Promise<{
            data: Array<{ id: string; title: string; status: string }> | null;
          }>;
        };
      };
      insert: (
        values: unknown
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: profileError } = await writable.from("profiles").upsert(
    {
      user_id: user.id,
      preferred_work_hours: parsed.data.preferredWorkHours,
      work_style: parsed.data.workStyle,
      common_avoidance_patterns: parsed.data.commonAvoidancePatterns
    },
    {
      onConflict: "user_id"
    }
  );

  if (profileError) {
    redirect("/onboarding?error=Unable%20to%20save%20your%20profile.");
  }

  const { data: existingGoals } = await writable
    .from("goals")
    .select("id, title, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const normalizedDesiredTitles = new Set(
    goals.map((goal) => goal.trim().toLowerCase())
  );
  const allGoals = existingGoals ?? [];
  const goalsToDeactivate = allGoals.filter(
    (goal) =>
      goal.status === "active" &&
      !normalizedDesiredTitles.has(goal.title.trim().toLowerCase())
  );
  const goalsToReactivate = allGoals.filter(
    (goal) =>
      goal.status !== "active" &&
      normalizedDesiredTitles.has(goal.title.trim().toLowerCase())
  );
  const existingTitles = new Set(
    allGoals.map((goal) => goal.title.trim().toLowerCase())
  );
  const newGoals = goals
    .filter((goal) => !existingTitles.has(goal.trim().toLowerCase()))
    .map((goal) => ({
      user_id: user.id,
      title: goal,
      status: "active" as const
    }));

  if (goalsToDeactivate.length > 0) {
    const goalIds = goalsToDeactivate.map((goal) => goal.id);

    const { error: goalsDeactivateError } = await writable
      .from("goals")
      .update({ status: "paused" })
      .eq("user_id", user.id)
      .in("id", goalIds);

    if (goalsDeactivateError) {
      redirect("/onboarding?error=Profile%20saved,%20but%20goals%20could%20not%20be%20updated.");
    }

    const { error: tasksArchiveError } = await writable
      .from("tasks")
      .update({ status: "archived" })
      .eq("user_id", user.id)
      .in("goal_id", goalIds);

    if (tasksArchiveError) {
      redirect("/onboarding?error=Goals%20updated,%20but%20related%20tasks%20could%20not%20be%20archived.");
    }
  }

  if (goalsToReactivate.length > 0) {
    const { error: reactivateError } = await writable
      .from("goals")
      .update({ status: "active" })
      .eq("user_id", user.id)
      .in(
        "id",
        goalsToReactivate.map((goal) => goal.id)
      );

    if (reactivateError) {
      redirect("/onboarding?error=Profile%20saved,%20but%20some%20goals%20could%20not%20be%20reactivated.");
    }
  }

  if (newGoals.length > 0) {
    const { error: goalsInsertError } = await writable.from("goals").insert(newGoals);

    if (goalsInsertError) {
      redirect("/onboarding?error=Profile%20saved,%20but%20goals%20failed.");
    }
  }

  await writable.from("memory_chunks").insert({
    user_id: user.id,
    source_type: "manual_note",
    content: `Work style: ${parsed.data.workStyle}. Avoidance patterns: ${parsed.data.commonAvoidancePatterns.join(", ")}.`,
    metadata: {
      source: "onboarding"
    }
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?success=Onboarding%20saved.");
}
