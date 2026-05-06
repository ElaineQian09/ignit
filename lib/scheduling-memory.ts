import type { MemoryLog, TodayScheduledBlock, WorkStyle } from "@/types/domain";

type MemoryEventType = MemoryLog["event_type"];

export interface BehaviorMemoryEntry {
  event_type: MemoryEventType;
  summary: string;
  metadata?: Record<string, unknown>;
}

function normalizeTopic(value: string) {
  const text = value.toLowerCase();

  if (text.includes("resume")) {
    return "resume";
  }

  if (text.includes("leetcode") || text.includes("interview")) {
    return "interview prep";
  }

  if (text.includes("review")) {
    return "review";
  }

  if (text.includes("write") || text.includes("draft") || text.includes("rewrite")) {
    return "writing";
  }

  if (text.includes("edit")) {
    return "editing";
  }

  return "task";
}

function isEveningBlock(startTime: string) {
  return new Date(startTime).getHours() >= 18;
}

function isLateNightBlock(startTime: string) {
  return new Date(startTime).getHours() >= 22;
}

function blockMinutes(startTime: string, endTime: string) {
  return Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
  );
}

export function buildScheduleAttemptMemories({
  scheduledBlocks,
  microActions,
  availableTimeToday,
  energyLevel,
  workStyle
}: {
  scheduledBlocks: Array<{
    micro_action_id: string;
    start_time: string;
    end_time: string;
    schedule_reason: string;
  }>;
  microActions: Array<{
    id: string;
    action_text: string;
  }>;
  availableTimeToday: number;
  energyLevel: "low" | "medium" | "high";
  workStyle: WorkStyle | null | undefined;
}): BehaviorMemoryEntry[] {
  if (scheduledBlocks.length === 0) {
    return [
      {
        event_type: "schedule_failure",
        summary:
          energyLevel === "low"
            ? "User needs fewer and smaller blocks when energy is low."
            : availableTimeToday <= 15
              ? "User needs only the first micro-action scheduled when time is short."
              : "User's current schedule could not fit another realistic block without overload.",
        metadata: {
          scheduled_count: 0,
          attempted_count: microActions.length,
          available_time_today: availableTimeToday,
          energy_level: energyLevel,
          work_style: workStyle ?? null
        }
      }
    ];
  }

  const firstScheduled = scheduledBlocks[0];
  const firstAction = microActions.find(
    (action) => action.id === firstScheduled.micro_action_id
  );
  const firstTopic = normalizeTopic(firstAction?.action_text ?? "task");
  const firstMinutes = blockMinutes(
    firstScheduled.start_time,
    firstScheduled.end_time
  );
  const entries: BehaviorMemoryEntry[] = [
    {
      event_type: "schedule_success",
      summary:
        firstMinutes <= 10
          ? `User works better when ${firstTopic} tasks are split into under 10-minute blocks.`
          : `User accepted a ${firstMinutes}-minute ${firstTopic} block without overloading the day.`,
      metadata: {
        scheduled_count: scheduledBlocks.length,
        attempted_count: microActions.length,
        first_block_minutes: firstMinutes,
        available_time_today: availableTimeToday,
        energy_level: energyLevel,
        work_style: workStyle ?? null
      }
    }
  ];

  if (energyLevel === "low" && scheduledBlocks.length <= 2) {
    entries.push({
      event_type: "schedule_success",
      summary: "User benefits from a lighter plan when energy is low.",
      metadata: {
        scheduled_count: scheduledBlocks.length,
        energy_level: energyLevel
      }
    });
  }

  return entries;
}

export function buildBlockOutcomeMemories({
  eventType,
  block,
  taskTitle,
  actionText,
  workStyle
}: {
  eventType: Extract<
    MemoryEventType,
    "block_completed" | "block_skipped" | "block_need_more_time" | "block_rescheduled"
  >;
  block: Pick<TodayScheduledBlock, "start_time" | "end_time" | "schedule_reason">;
  taskTitle?: string | null;
  actionText?: string | null;
  workStyle?: WorkStyle | null;
}): BehaviorMemoryEntry[] {
  const joinedText = `${taskTitle ?? ""} ${actionText ?? ""}`.trim();
  const topic = normalizeTopic(joinedText || "task");
  const minutes = blockMinutes(block.start_time, block.end_time);
  const evening = isEveningBlock(block.start_time);
  const lateNight = isLateNightBlock(block.start_time);

  if (eventType === "block_completed") {
    return [
      {
        event_type: "block_completed",
        summary:
          minutes <= 10 && evening
            ? `User completed ${topic} work successfully in a short evening block.`
            : topic === "review" && minutes <= 10
              ? "User completes small review tasks better before starting new work."
              : `User completed a scheduled ${topic} block as planned.`,
        metadata: {
          topic,
          minutes,
          work_style: workStyle ?? null
        }
      }
    ];
  }

  if (eventType === "block_need_more_time") {
    return [
      {
        event_type: "block_need_more_time",
        summary:
          topic === "resume" || topic === "editing"
            ? "User often underestimates resume editing time."
            : `User often needs more than one block for ${topic} work.`,
        metadata: {
          topic,
          minutes,
          work_style: workStyle ?? null
        }
      }
    ];
  }

  if (eventType === "block_skipped") {
    return [
      {
        event_type: "block_skipped",
        summary:
          lateNight
            ? `User tends to skip difficult tasks after 10 PM.`
            : `User skipped a scheduled ${topic} block and may need a smaller restart step.`,
        metadata: {
          topic,
          minutes,
          late_night: lateNight,
          work_style: workStyle ?? null
        }
      }
    ];
  }

  return [
    {
      event_type: "block_rescheduled",
      summary:
        workStyle === "Needs external prompts"
          ? "User responds better when work blocks are moved to a cleaner restart point."
          : `User needed ${topic} work moved to the next available slot.`,
      metadata: {
        topic,
        minutes,
        work_style: workStyle ?? null
      }
    }
  ];
}
