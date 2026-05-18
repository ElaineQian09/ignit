import { NextResponse } from "next/server";

import { AiUsageLimitError, getIpAddressFromHeaders, reserveAiUsage } from "@/lib/ai-usage-guard";
import { getAiLimitEnv } from "@/lib/env";
import { generateMicroActionPlan } from "@/lib/orchestrator";
import { createClient } from "@/lib/supabase/server";
import { generateMicroActionRequestSchema } from "@/lib/validators";
import type { Profile, UserSchedulePreferences, WorkStyle } from "@/types/domain";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = generateMicroActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid micro-action request.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const [{ data: preferencesData, error: preferencesError }, { data: profileData }] =
    await Promise.all([
      supabase
        .from("user_schedule_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("work_style")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);

  if (preferencesError) {
    return NextResponse.json(
      { error: "Unable to load schedule preferences." },
      { status: 500 }
    );
  }

  const preferences = (preferencesData ?? null) as UserSchedulePreferences | null;

  if (!preferences) {
    return NextResponse.json(
      { error: "Schedule preferences are not configured." },
      { status: 400 }
    );
  }

  const profile = (profileData ?? null) as Pick<Profile, "work_style"> | null;
  const workStyle =
    (profile?.work_style as WorkStyle | null | undefined) ?? null;

  try {
    const { generationEstimatedSpendCents } = getAiLimitEnv();
    await reserveAiUsage(supabase as never, {
      userId: user.id,
      ipAddress: getIpAddressFromHeaders(request.headers),
      routeKey: "api_generate_micro_action",
      estimatedSpendCents: generationEstimatedSpendCents
    });
  } catch (error) {
    if (error instanceof AiUsageLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to verify AI usage limits." },
      { status: 500 }
    );
  }

  const result = await generateMicroActionPlan({
    userId: user.id,
    task: parsed.data.task,
    triggerSource: "api_generate_micro_action",
    energyLevel: parsed.data.energy_level,
    userPreferences: preferences,
    taskDeadline: parsed.data.deadline ?? null,
    availableTimeToday: parsed.data.available_time_today,
    workStyle
  });

  return NextResponse.json({
    resistance_type: result.resistance_type,
    micro_action: result.micro_action,
    estimated_time: result.estimated_time,
    review: result.review,
    recovery_applied: result.recovery_applied,
    agent_run_id: result.agent_run_id,
    schedule: {
      start_time: result.schedule.start_time,
      end_time: result.schedule.end_time
    }
  });
}
