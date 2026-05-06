import { NextResponse } from "next/server";

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
