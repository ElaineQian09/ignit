import {
  createMemoryAgent,
  memoryAgent,
  type MemoryAgentOutput
} from "@/lib/agents/memoryAgent";
import {
  createMicroActionAgent,
  microActionAgent,
  type MicroActionAgentOutput
} from "@/lib/agents/microActionAgent";
import {
  classifyResistanceType,
  resistanceAgent,
  type ResistanceAgentOutput
} from "@/lib/agents/resistanceAgent";
import {
  createSchedulerAgent,
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

export interface GenerateMicroActionPlanDependencies {
  memoryAgent: typeof memoryAgent;
  resistanceAgent: typeof resistanceAgent;
  microActionAgent: typeof microActionAgent;
  schedulerAgent: typeof schedulerAgent;
}

export function createGenerateMicroActionPlan(
  dependencies: GenerateMicroActionPlanDependencies = {
    memoryAgent: createMemoryAgent(),
    resistanceAgent,
    microActionAgent: createMicroActionAgent(),
    schedulerAgent: createSchedulerAgent()
  }
) {
  return async function generateMicroActionPlan(
    input: GenerateMicroActionInput
  ): Promise<GenerateMicroActionOutput> {
    const [memoryResult, resistanceResult] = await Promise.all([
      dependencies.memoryAgent({
        userId: input.userId,
        task: input.task
      }),
      dependencies.resistanceAgent({
        task: input.task
      })
    ]);

    const refinedResistance =
      memoryResult.memories.length > 0
        ? classifyResistanceType({
            task: input.task,
            memories: memoryResult.memories
          })
        : resistanceResult.resistance_type;

    const microAction = await dependencies.microActionAgent({
      task: input.task,
      memories: memoryResult.memories,
      resistance_type: refinedResistance
    });

    const schedule = await dependencies.schedulerAgent({
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
      resistance_type: refinedResistance,
      ...microAction,
      schedule
    };
  };
}

export const generateMicroActionPlan = createGenerateMicroActionPlan();
