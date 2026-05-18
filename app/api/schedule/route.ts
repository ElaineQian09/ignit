import { NextResponse } from "next/server";

import { AiUsageLimitError, getIpAddressFromHeaders, reserveAiUsage } from "@/lib/ai-usage-guard";
import { getAiLimitEnv } from "@/lib/env";
import { insertMemoryLogs } from "@/lib/memory-logs";
import { buildScheduleAttemptMemories } from "@/lib/scheduling-memory";
import { createClient } from "@/lib/supabase/server";
import { scheduleMicroActions } from "@/lib/scheduler";
import { scheduleRequestSchema } from "@/lib/validators";
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
  const parsed = scheduleRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid scheduling payload.",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { data: preferencesData, error: preferencesError } = await supabase
    .from("user_schedule_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

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

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("work_style")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Unable to load work style." },
      { status: 500 }
    );
  }

  const profile = (profileData ?? null) as Pick<Profile, "work_style"> | null;
  const workStyle =
    (profile?.work_style as WorkStyle | null | undefined) ?? null;

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", parsed.data.task_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (taskError) {
    return NextResponse.json(
      { error: "Unable to verify task ownership." },
      { status: 500 }
    );
  }

  if (!taskData) {
    return NextResponse.json(
      { error: "Task not found for this user." },
      { status: 403 }
    );
  }

  const requestedMicroActionIds = parsed.data.micro_actions.map((action) => action.id);
  const { data: microActionRows, error: microActionError } = await supabase
    .from("micro_actions")
    .select("id, task_id, tasks!inner(user_id)")
    .in("id", requestedMicroActionIds)
    .eq("task_id", parsed.data.task_id)
    .eq("tasks.user_id", user.id);

  if (microActionError) {
    return NextResponse.json(
      { error: "Unable to verify micro-action ownership." },
      { status: 500 }
    );
  }

  const ownedMicroActionIds = new Set(
    ((microActionRows ?? []) as Array<{ id: string }>).map((row) => row.id)
  );

  if (ownedMicroActionIds.size !== requestedMicroActionIds.length) {
    return NextResponse.json(
      { error: "One or more micro-actions do not belong to this user task." },
      { status: 403 }
    );
  }

  const scheduled = scheduleMicroActions({
    userPreferences: preferences,
    taskDeadline: parsed.data.deadline ?? null,
    availableTimeToday: parsed.data.available_time_today,
    microActions: parsed.data.micro_actions,
    energyLevel: parsed.data.energy_level,
    workStyle
  });
  const behaviorMemories = buildScheduleAttemptMemories({
    scheduledBlocks: scheduled,
    microActions: parsed.data.micro_actions,
    availableTimeToday: parsed.data.available_time_today,
    energyLevel: parsed.data.energy_level,
    workStyle
  });

  const writable = supabase as unknown as {
    from: (table: string) => {
      insert: (
        values: unknown
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  try {
    const { embeddingEstimatedSpendCents } = getAiLimitEnv();
    await reserveAiUsage(supabase as never, {
      userId: user.id,
      ipAddress: getIpAddressFromHeaders(request.headers),
      routeKey: "api_schedule",
      estimatedSpendCents: embeddingEstimatedSpendCents * behaviorMemories.length
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

  if (scheduled.length === 0) {
    await insertMemoryLogs(
      writable,
      behaviorMemories.map((entry) => ({
        user_id: user.id,
        event_type: entry.event_type,
        summary: entry.summary,
        metadata: entry.metadata ?? null
      }))
    );
    return NextResponse.json([], { status: 200 });
  }

  const { error: insertError } = await writable.from("scheduled_blocks").insert(
    scheduled.map((block) => ({
      user_id: user.id,
      task_id: parsed.data.task_id,
      micro_action_id: block.micro_action_id,
      start_time: block.start_time,
      end_time: block.end_time,
      status: "scheduled" as const,
      schedule_reason: block.schedule_reason,
      rescheduled_from_block_id: null
    }))
  );

  if (insertError) {
    await insertMemoryLogs(writable, [
      {
        user_id: user.id,
        event_type: "schedule_failure",
        summary: "Scheduling found blocks, but they could not be saved.",
        metadata: {
          task_id: parsed.data.task_id,
          reason: insertError.message
        }
      }
    ]);
    return NextResponse.json(
      { error: "Unable to persist scheduled blocks." },
      { status: 500 }
    );
  }

  await insertMemoryLogs(
    writable,
    behaviorMemories.map((entry) => ({
      user_id: user.id,
      event_type: entry.event_type,
      summary: entry.summary,
      metadata: entry.metadata ?? null
    }))
  );

  return NextResponse.json(scheduled);
}
