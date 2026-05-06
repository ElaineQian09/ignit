import { memoryAgent, type MemoryAgentOutput } from "@/lib/agents/memoryAgent";
import {
  microActionAgent,
  type MicroActionAgentOutput
} from "@/lib/agents/microActionAgent";
import {
  resistanceAgent,
  type ResistanceAgentOutput
} from "@/lib/agents/resistanceAgent";
import {
  schedulerAgent,
  type SchedulerAgentOutput
} from "@/lib/agents/schedulerAgent";
import type { EnergyLevel, UserSchedulePreferences, WorkStyle } from "@/types/domain";

export interface GenerateMicroActionInput {
  userId: string;
  task: string;
  energyLevel: EnergyLevel;
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
  availableTimeToday?: number;
  workStyle?: WorkStyle | null;
}

export interface GenerateMicroActionOutput
  extends ResistanceAgentOutput,
    MemoryAgentOutput,
    MicroActionAgentOutput {
  schedule: SchedulerAgentOutput;
}

export async function generateMicroActionPlan(
  input: GenerateMicroActionInput
): Promise<GenerateMicroActionOutput> {
  const [memoryResult, resistanceResult] = await Promise.all([
    memoryAgent({
      userId: input.userId,
      task: input.task
    }),
    resistanceAgent({
      task: input.task
    })
  ]);

  const microAction = await microActionAgent({
    task: input.task,
    memories: memoryResult.memories,
    resistance_type: resistanceResult.resistance_type
  });

  const schedule = await schedulerAgent({
    micro_action: microAction.micro_action,
    estimated_minutes: microAction.estimated_minutes,
    userPreferences: input.userPreferences,
    energyLevel: input.energyLevel,
    taskDeadline: input.taskDeadline ?? null,
    availableTimeToday: input.availableTimeToday,
    workStyle: input.workStyle ?? null
  });

  return {
    ...memoryResult,
    ...resistanceResult,
    ...microAction,
    schedule
  };
}
