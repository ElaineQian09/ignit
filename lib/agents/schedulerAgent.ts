import { scheduleMicroActions } from "@/lib/scheduler";
import type { EnergyLevel, UserSchedulePreferences, WorkStyle } from "@/types/domain";

export interface SchedulerAgentInput {
  micro_action: string;
  estimated_minutes: number;
  userPreferences: Pick<
    UserSchedulePreferences,
    | "preferred_days"
    | "preferred_start_time"
    | "preferred_end_time"
    | "max_daily_focus_minutes"
    | "preferred_session_minutes"
    | "break_minutes"
    | "high_energy_periods"
    | "low_energy_periods"
  >;
  energyLevel: EnergyLevel;
  taskDeadline?: string | null;
  availableTimeToday?: number;
  workStyle?: WorkStyle | null;
}

export interface SchedulerAgentOutput {
  start_time: string;
  end_time: string;
  schedule_reason: string;
}

export interface SchedulerAgentDependencies {
  scheduleMicroActions: typeof scheduleMicroActions;
}

function nextPreferredDayIndex(
  preferredDays: string[] | null | undefined,
  startDay: number
) {
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  if (!preferredDays || preferredDays.length === 0) {
    return startDay;
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (startDay + offset) % 7;

    if (preferredDays.includes(names[dayIndex])) {
      return dayIndex;
    }
  }

  return startDay;
}

function buildFallbackSchedule(
  estimatedMinutes: number,
  preferences: SchedulerAgentInput["userPreferences"]
): SchedulerAgentOutput {
  const now = new Date();
  const preferredDay = nextPreferredDayIndex(
    preferences.preferred_days,
    now.getDay()
  );
  const start = new Date(now);
  const dayOffset = (preferredDay - now.getDay() + 7) % 7;
  start.setDate(start.getDate() + dayOffset);

  const [startHours, startMinutes] = (preferences.preferred_start_time ?? "09:00")
    .split(":")
    .map(Number);
  start.setHours(startHours, startMinutes, 0, 0);

  if (start < now) {
    start.setDate(start.getDate() + 1);
  }

  const end = new Date(start.getTime() + Math.max(estimatedMinutes, 1) * 60000);

  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    schedule_reason:
      "Used the next preferred focus window because no safer scheduled slot was available."
  };
}

export function createSchedulerAgent(
  dependencies: SchedulerAgentDependencies = {
    scheduleMicroActions
  }
) {
  return async function schedulerAgent(
    input: SchedulerAgentInput
  ): Promise<SchedulerAgentOutput> {
    const availableTimeToday =
      input.availableTimeToday ??
      input.userPreferences.preferred_session_minutes ??
      input.userPreferences.max_daily_focus_minutes ??
      Math.max(input.estimated_minutes, 5);
    const blocks = dependencies.scheduleMicroActions({
      userPreferences: input.userPreferences,
      taskDeadline: input.taskDeadline ?? null,
      availableTimeToday: Math.max(availableTimeToday, input.estimated_minutes),
      microActions: [
        {
          id: "generated-start-step",
          action_text: input.micro_action,
          estimated_minutes: input.estimated_minutes
        }
      ],
      energyLevel: input.energyLevel,
      workStyle: input.workStyle ?? null
    });

    if (blocks[0]) {
      return {
        start_time: blocks[0].start_time,
        end_time: blocks[0].end_time,
        schedule_reason: blocks[0].schedule_reason
      };
    }

    return buildFallbackSchedule(input.estimated_minutes, input.userPreferences);
  };
}

export const schedulerAgent = createSchedulerAgent();
