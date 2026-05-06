import type { Json } from "@/types/database";
import { clamp } from "@/lib/utils";
import type {
  EnergyLevel,
  TimePeriod,
  UserSchedulePreferences,
  WorkStyle
} from "@/types/domain";

interface SchedulerMicroAction {
  id: string;
  action_text: string;
  estimated_minutes: number;
}

interface ScheduleMicroActionsInput {
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
  taskDeadline?: string | null;
  availableTimeToday: number;
  microActions: SchedulerMicroAction[];
  energyLevel: EnergyLevel;
  workStyle?: WorkStyle | null;
  existingBlocks?: Array<{
    start_time: string;
    end_time: string;
    status?: string | null;
  }>;
  searchStartTime?: string | null;
}

export interface ScheduledActionBlock {
  micro_action_id: string;
  start_time: string;
  end_time: string;
  schedule_reason: string;
}

interface NormalizedDay {
  date: Date;
  budgetMinutes: number;
  scheduledMinutes: number;
  lastBlockEnd: Date | null;
  slots: Array<{
    start: Date;
    end: Date;
    cursor: Date;
    category: "high" | "neutral" | "low";
  }>;
}

type SlotCategory = "high" | "neutral" | "low";
type ActionDifficulty = "easy" | "medium" | "hard";
type OccupiedBlock = {
  start: Date;
  end: Date;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

function parseTimeString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

function applyTime(baseDate: Date, value: string) {
  const parsed = parseTimeString(value);

  if (!parsed) {
    return null;
  }

  const next = new Date(baseDate);
  next.setHours(parsed.hours, parsed.minutes, 0, 0);
  return next;
}

function parseTimePeriods(value: Json | null | undefined): TimePeriod[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const start = "start_time" in item ? item.start_time : null;
    const end = "end_time" in item ? item.end_time : null;

    if (typeof start !== "string" || typeof end !== "string") {
      return [];
    }

    if (!parseTimeString(start) || !parseTimeString(end) || start >= end) {
      return [];
    }

    return [{ start_time: start, end_time: end }];
  });
}

function diffMinutes(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 60000);
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60000);
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDeadlineCutoff(deadline: string | null | undefined) {
  if (!deadline) {
    return null;
  }

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const cutoff = new Date(parsed);
  cutoff.setHours(23, 59, 59, 999);
  return cutoff;
}

function isWithinPeriods(moment: Date, periods: Array<{ start: Date; end: Date }>) {
  return periods.some((period) => moment >= period.start && moment < period.end);
}

function subtractOccupiedIntervals(
  slots: Array<{
    start: Date;
    end: Date;
    cursor: Date;
    category: SlotCategory;
  }>,
  occupiedBlocks: OccupiedBlock[]
) {
  if (occupiedBlocks.length === 0) {
    return slots;
  }

  return slots.flatMap((slot) => {
    let segments = [{ start: slot.start, end: slot.end }];

    for (const occupied of occupiedBlocks) {
      segments = segments.flatMap((segment) => {
        if (occupied.end <= segment.start || occupied.start >= segment.end) {
          return [segment];
        }

        const nextSegments: Array<{ start: Date; end: Date }> = [];

        if (occupied.start > segment.start) {
          nextSegments.push({
            start: segment.start,
            end: occupied.start
          });
        }

        if (occupied.end < segment.end) {
          nextSegments.push({
            start: occupied.end,
            end: segment.end
          });
        }

        return nextSegments;
      });
    }

    return segments
      .filter((segment) => segment.end > segment.start)
      .map((segment) => ({
        start: segment.start,
        end: segment.end,
        cursor: new Date(segment.start),
        category: slot.category
      }));
  });
}

function getOccupiedBlocksForDay(
  existingBlocks: Array<{
    start_time: string;
    end_time: string;
    status?: string | null;
  }>,
  day: Date
) {
  const eligibleStatuses = new Set(["scheduled", "in_progress"]);
  const dayStart = startOfDay(day);
  const nextDayStart = addMinutes(dayStart, 24 * 60);

  return existingBlocks
    .filter((block) => eligibleStatuses.has(block.status ?? "scheduled"))
    .map((block) => ({
      start: new Date(block.start_time),
      end: new Date(block.end_time)
    }))
    .filter((block) => block.end > dayStart && block.start < nextDayStart)
    .map((block) => ({
      start: block.start < dayStart ? dayStart : block.start,
      end: block.end > nextDayStart ? nextDayStart : block.end
    }))
    .filter((block) => block.end > block.start);
}

function buildSlotsForDay(
  day: Date,
  startTime: string,
  endTime: string,
  highPeriods: TimePeriod[],
  lowPeriods: TimePeriod[],
  occupiedBlocks: OccupiedBlock[],
  minimumStartTime?: Date | null
) {
  const windowStart = applyTime(day, startTime);
  const windowEnd = applyTime(day, endTime);

  if (!windowStart || !windowEnd || windowStart >= windowEnd) {
    return [];
  }

  const high = highPeriods
    .map((period) => ({
      start: applyTime(day, period.start_time),
      end: applyTime(day, period.end_time)
    }))
    .filter(
      (
        period
      ): period is {
        start: Date;
        end: Date;
      } => Boolean(period.start && period.end && period.start < period.end)
    );
  const low = lowPeriods
    .map((period) => ({
      start: applyTime(day, period.start_time),
      end: applyTime(day, period.end_time)
    }))
    .filter(
      (
        period
      ): period is {
        start: Date;
        end: Date;
      } => Boolean(period.start && period.end && period.start < period.end)
    );

  const boundaries = new Set<number>([
    windowStart.getTime(),
    windowEnd.getTime()
  ]);

  [...high, ...low].forEach((period) => {
    const start = Math.max(period.start.getTime(), windowStart.getTime());
    const end = Math.min(period.end.getTime(), windowEnd.getTime());

    if (start < end) {
      boundaries.add(start);
      boundaries.add(end);
    }
  });

  const orderedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

  const baseSlots = orderedBoundaries.flatMap((boundary, index) => {
    const nextBoundary = orderedBoundaries[index + 1];

    if (!nextBoundary || nextBoundary <= boundary) {
      return [];
    }

    const start = new Date(boundary);
    const end = new Date(nextBoundary);
    const midpoint = new Date((boundary + nextBoundary) / 2);

    const category: SlotCategory = isWithinPeriods(midpoint, high)
      ? "high"
      : isWithinPeriods(midpoint, low)
        ? "low"
        : "neutral";

    return [{ start, end, cursor: new Date(start), category }];
  });

  const freeSlots = subtractOccupiedIntervals(baseSlots, occupiedBlocks);

  if (!minimumStartTime) {
    return freeSlots;
  }

  return freeSlots
    .map((slot) => ({
      ...slot,
      start:
        slot.start < minimumStartTime && slot.end > minimumStartTime
          ? minimumStartTime
          : slot.start,
      cursor:
        slot.cursor < minimumStartTime && slot.end > minimumStartTime
          ? new Date(minimumStartTime)
          : slot.cursor
    }))
    .filter((slot) => slot.end > slot.start);
}

function classifyActionDifficulty(action: SchedulerMicroAction): ActionDifficulty {
  const text = action.action_text.toLowerCase();
  const hardKeywords = [
    "write",
    "draft",
    "design",
    "build",
    "implement",
    "analyze",
    "refactor",
    "plan"
  ];
  const lowFrictionKeywords = [
    "open",
    "rename",
    "list",
    "review",
    "scan",
    "collect",
    "check"
  ];

  if (action.estimated_minutes >= 15 || hardKeywords.some((keyword) => text.includes(keyword))) {
    return "hard";
  }

  if (action.estimated_minutes <= 7 || lowFrictionKeywords.some((keyword) => text.includes(keyword))) {
    return "easy";
  }

  return "medium";
}

function getCategoryPreferences(
  difficulty: ActionDifficulty,
  energyLevel: EnergyLevel,
  workStyle: WorkStyle | null | undefined
) {
  if (workStyle === "Sprint-based") {
    return ["high", "neutral", "low"] as const;
  }

  if (workStyle === "Needs external prompts") {
    if (difficulty === "easy") {
      return ["neutral", "low", "high"] as const;
    }

    return ["neutral", "high", "low"] as const;
  }

  if (difficulty === "hard") {
    return ["high", "neutral", "low"] as const;
  }

  if (difficulty === "easy" || energyLevel === "low") {
    return ["low", "neutral", "high"] as const;
  }

  return ["neutral", "high", "low"] as const;
}

function getActionDuration(
  action: SchedulerMicroAction,
  preferredSessionMinutes: number,
  workStyle: WorkStyle | null | undefined
) {
  if (workStyle === "Needs external prompts") {
    return clamp(Math.min(action.estimated_minutes, 10), 5, 10);
  }

  if (workStyle === "Sprint-based") {
    return clamp(
      Math.min(action.estimated_minutes, preferredSessionMinutes, 25),
      5,
      25
    );
  }

  if (workStyle === "Structured") {
    return clamp(Math.min(action.estimated_minutes, preferredSessionMinutes), 5, 30);
  }

  return clamp(Math.min(action.estimated_minutes, preferredSessionMinutes), 5, 25);
}

function buildScheduleDays(input: ScheduleMicroActionsInput) {
  const startTime = input.userPreferences.preferred_start_time ?? "18:00";
  const endTime = input.userPreferences.preferred_end_time ?? "21:00";
  const maxDailyFocusMinutes = input.userPreferences.max_daily_focus_minutes ?? 120;
  const preferredDays = input.userPreferences.preferred_days?.length
    ? new Set(input.userPreferences.preferred_days)
    : null;
  const highPeriods = parseTimePeriods(input.userPreferences.high_energy_periods);
  const lowPeriods = parseTimePeriods(input.userPreferences.low_energy_periods);
  const deadline = getDeadlineCutoff(input.taskDeadline);
  const referenceTime = input.searchStartTime
    ? new Date(input.searchStartTime)
    : new Date();
  referenceTime.setSeconds(0, 0);

  const dayCount = deadline
    ? Math.max(1, Math.min(14, diffMinutes(referenceTime, deadline) / (60 * 24) + 1))
    : 7;
  const days: NormalizedDay[] = [];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = startOfDay(referenceTime);
    date.setDate(date.getDate() + offset);

    if (preferredDays && !preferredDays.has(DAY_NAMES[date.getDay()])) {
      continue;
    }

    const occupiedBlocks = getOccupiedBlocksForDay(input.existingBlocks ?? [], date);
    const occupiedMinutes = occupiedBlocks.reduce(
      (total, block) => total + diffMinutes(block.start, block.end),
      0
    );

    const budgetMinutes =
      offset === 0
        ? Math.min(input.availableTimeToday, maxDailyFocusMinutes) - occupiedMinutes
        : maxDailyFocusMinutes - occupiedMinutes;

    if (budgetMinutes <= 0) {
      continue;
    }

    const minimumStartTime =
      offset === 0 && startOfDay(referenceTime).getTime() === date.getTime()
        ? referenceTime
        : null;
    const slots = buildSlotsForDay(
      date,
      startTime,
      endTime,
      highPeriods,
      lowPeriods,
      occupiedBlocks,
      minimumStartTime
    );

    if (slots.length === 0) {
      continue;
    }

    days.push({
      date,
      budgetMinutes,
      scheduledMinutes: occupiedMinutes,
      lastBlockEnd: null,
      slots
    });
  }

  return days;
}

function buildReason(
  action: SchedulerMicroAction,
  difficulty: ActionDifficulty,
  slotCategory: SlotCategory,
  deadline: string | null | undefined,
  workStyle: WorkStyle | null | undefined
) {
  const reasons: string[] = [];

  if (deadline) {
    reasons.push("deadline pressure keeps this task near the front of the queue");
  }

  if (difficulty === "hard" && slotCategory === "high") {
    reasons.push("this is a heavier action placed in a high-energy window");
  } else if (difficulty === "easy" && slotCategory === "low") {
    reasons.push("this is a low-friction action matched to a lower-energy window");
  } else {
    reasons.push("this block fits the remaining focus window without overloading the day");
  }

  if (action.estimated_minutes <= 7) {
    reasons.push("the short duration makes it realistic to start");
  }

  if (workStyle === "Structured") {
    reasons.push("the timing preserves a clear, ordered progression");
  } else if (workStyle === "Flexible") {
    reasons.push("the block leaves room to choose a natural entry point");
  } else if (workStyle === "Sprint-based") {
    reasons.push("the block is shaped like a compact sprint instead of a long session");
  } else if (workStyle === "Needs external prompts") {
    reasons.push("the block is early and short enough to work with an external prompt");
  }

  return reasons.join("; ");
}

export function scheduleMicroActions(
  input: ScheduleMicroActionsInput
): ScheduledActionBlock[] {
  const days = buildScheduleDays(input);
  const preferredSessionMinutes =
    input.userPreferences.preferred_session_minutes ?? 25;
  const breakMinutes =
    input.workStyle === "Sprint-based"
      ? Math.max(input.userPreferences.break_minutes ?? 5, 5)
      : input.workStyle === "Needs external prompts"
        ? Math.max(input.userPreferences.break_minutes ?? 5, 3)
        : input.userPreferences.break_minutes ?? 5;
  const deadline = getDeadlineCutoff(input.taskDeadline);
  const urgencyDays =
    deadline === null ? Number.POSITIVE_INFINITY : diffMinutes(new Date(), deadline) / (60 * 24);
  const constrainedMicroActions =
    input.availableTimeToday <= 15
      ? input.microActions.slice(0, 1)
      : input.energyLevel === "low"
        ? input.microActions.slice(
            0,
            input.availableTimeToday <= 25 ? 1 : 2
          )
        : input.microActions;
  const sortedActions = [...constrainedMicroActions].sort((left, right) => {
    const leftDifficulty = classifyActionDifficulty(left);
    const rightDifficulty = classifyActionDifficulty(right);

    if (input.workStyle === "Structured") {
      const structuredRank = { hard: 0, medium: 1, easy: 2 } as const;
      return (
        structuredRank[leftDifficulty] - structuredRank[rightDifficulty] ||
        right.estimated_minutes - left.estimated_minutes
      );
    }

    if (input.workStyle === "Flexible") {
      const flexibleRank = { easy: 0, medium: 1, hard: 2 } as const;
      return (
        flexibleRank[leftDifficulty] - flexibleRank[rightDifficulty] ||
        left.estimated_minutes - right.estimated_minutes
      );
    }

    if (input.workStyle === "Needs external prompts") {
      const promptRank = { easy: 0, medium: 1, hard: 2 } as const;
      return (
        promptRank[leftDifficulty] - promptRank[rightDifficulty] ||
        left.estimated_minutes - right.estimated_minutes
      );
    }

    if (urgencyDays <= 2) {
      const hardRank = { hard: 0, medium: 1, easy: 2 } as const;
      return (
        hardRank[leftDifficulty] - hardRank[rightDifficulty] ||
        right.estimated_minutes - left.estimated_minutes
      );
    }

    const easyRank = { easy: 0, medium: 1, hard: 2 } as const;
    return (
      easyRank[leftDifficulty] - easyRank[rightDifficulty] ||
      left.estimated_minutes - right.estimated_minutes
    );
  });

  const scheduled: ScheduledActionBlock[] = [];

  for (const action of sortedActions) {
    const difficulty = classifyActionDifficulty(action);
    const scheduledMinutes = getActionDuration(
      action,
      preferredSessionMinutes,
      input.workStyle
    );
    const cappedScheduledMinutes =
      input.energyLevel === "low"
        ? Math.min(scheduledMinutes, 10)
        : urgencyDays <= 2 && action === sortedActions[0]
          ? Math.min(scheduledMinutes, 10)
          : scheduledMinutes;
    const preferredCategories = getCategoryPreferences(
      difficulty,
      input.energyLevel,
      input.workStyle
    );
    let placed = false;

    for (const category of preferredCategories) {
      for (const day of days) {
        if (day.scheduledMinutes + cappedScheduledMinutes > day.budgetMinutes) {
          continue;
        }

        for (const slot of day.slots) {
          if (slot.category !== category) {
            continue;
          }

          if (
            input.workStyle === "Needs external prompts" &&
            day.lastBlockEnd &&
            day.lastBlockEnd.toDateString() === day.date.toDateString()
          ) {
            continue;
          }

          const breakOffset =
            day.lastBlockEnd && day.lastBlockEnd.toDateString() === day.date.toDateString()
              ? breakMinutes
              : 0;
          const earliestStart = new Date(
            Math.max(
              slot.cursor.getTime(),
              (day.lastBlockEnd
                ? addMinutes(day.lastBlockEnd, breakOffset)
                : slot.start
              ).getTime(),
              slot.start.getTime()
            )
          );
          const end = addMinutes(earliestStart, cappedScheduledMinutes);

          if (end > slot.end) {
            continue;
          }

          if (deadline && end > deadline) {
            continue;
          }

          scheduled.push({
            micro_action_id: action.id,
            start_time: earliestStart.toISOString(),
            end_time: end.toISOString(),
            schedule_reason: buildReason(
              action,
              difficulty,
              slot.category,
              input.taskDeadline ?? null,
              input.workStyle
            )
          });

          slot.cursor = end;
          day.lastBlockEnd = end;
          day.scheduledMinutes += cappedScheduledMinutes;
          placed = true;
          break;
        }

        if (placed) {
          break;
        }
      }

      if (placed) {
        break;
      }
    }
  }

  return scheduled.sort((left, right) => left.start_time.localeCompare(right.start_time));
}
