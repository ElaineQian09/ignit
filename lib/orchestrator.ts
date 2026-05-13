import {
  appendAgentStep,
  startAgentRun,
  updateAgentRun
} from "@/lib/agent-run-store";
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
  recoveryAgent,
  type RecoveryAgentInput
} from "@/lib/agents/recoveryAgent";
import {
  classifyResistanceType,
  resistanceAgent,
  type ResistanceAgentOutput
} from "@/lib/agents/resistanceAgent";
import {
  reviewAgent,
  type ReviewAgentOutput
} from "@/lib/agents/reviewAgent";
import {
  createSchedulerAgent,
  schedulerAgent,
  type SchedulerAgentOutput
} from "@/lib/agents/schedulerAgent";
import { createClient } from "@/lib/supabase/server";
import type { EnergyLevel, UserSchedulePreferences, WorkStyle } from "@/types/domain";

type TriggerSource =
  | "task_creation"
  | "api_generate_micro_action"
  | "schedule_recovery"
  | "manual_replan";

type WritableClient = Awaited<ReturnType<typeof createClient>>;

export interface GenerateMicroActionInput {
  userId: string;
  task: string;
  taskId?: string | null;
  planId?: string | null;
  triggerSource?: TriggerSource;
  avoidMicroAction?: string | null;
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
  review: ReviewAgentOutput;
  recovery_applied: boolean;
  agent_run_id: string | null;
}

export interface GenerateMicroActionPlanDependencies {
  memoryAgent: typeof memoryAgent;
  resistanceAgent: typeof resistanceAgent;
  microActionAgent: typeof microActionAgent;
  reviewAgent: (input: {
    task: string;
    resistance_type: ResistanceAgentOutput["resistance_type"];
    micro_action: MicroActionAgentOutput;
  }) => Promise<ReviewAgentOutput>;
  recoveryAgent: (input: RecoveryAgentInput) => Promise<MicroActionAgentOutput>;
  schedulerAgent: typeof schedulerAgent;
  createWritableClient: () => Promise<WritableClient>;
}

function buildSharedState(input: GenerateMicroActionInput) {
  return {
    task: input.task,
    task_id: input.taskId ?? null,
    plan_id: input.planId ?? null,
    trigger_source: input.triggerSource ?? "manual_replan",
    avoid_micro_action: input.avoidMicroAction ?? null,
    energy_level: input.energyLevel,
    work_style: input.workStyle ?? null
  };
}

async function recordStep(
  writable: WritableClient | null,
  runId: string | null,
  input: Omit<Parameters<typeof appendAgentStep>[1], "runId">
) {
  if (!writable || !runId) {
    return;
  }

  await appendAgentStep(writable as never, {
    ...input,
    runId
  });
}

async function recordRunUpdate(
  writable: WritableClient | null,
  runId: string | null,
  values: Parameters<typeof updateAgentRun>[2]
) {
  if (!writable || !runId) {
    return;
  }

  await updateAgentRun(writable as never, runId, values);
}

export function createGenerateMicroActionPlan(
  dependencies: GenerateMicroActionPlanDependencies = {
    memoryAgent: createMemoryAgent(),
    resistanceAgent,
    microActionAgent: createMicroActionAgent(),
    reviewAgent,
    recoveryAgent,
    schedulerAgent: createSchedulerAgent(),
    createWritableClient: createClient
  }
) {
  return async function generateMicroActionPlan(
    input: GenerateMicroActionInput
  ): Promise<GenerateMicroActionOutput> {
    const sharedState = buildSharedState(input);
    let writable: WritableClient | null = null;
    let agentRunId: string | null = null;

    try {
      try {
        writable = await dependencies.createWritableClient();
        agentRunId = await startAgentRun(writable as never, {
          userId: input.userId,
          taskId: input.taskId ?? null,
          planId: input.planId ?? null,
          triggerSource: input.triggerSource ?? "manual_replan",
          input,
          sharedState
        });
      } catch (error) {
        console.error("Unable to initialize agent coordinator run:", error);
      }

      const [memoryResult, resistanceResult] = await Promise.all([
        dependencies.memoryAgent({
          userId: input.userId,
          task: input.task
        }),
        dependencies.resistanceAgent({
          task: input.task
        })
      ]);

      await recordStep(writable, agentRunId, {
        agentName: "memoryAgent",
        input: {
          user_id: input.userId,
          task: input.task
        },
        output: memoryResult,
        summary:
          memoryResult.memories.length > 0
            ? `Retrieved ${memoryResult.memories.length} relevant memory items.`
            : "No relevant memory items were found."
      });
      await recordStep(writable, agentRunId, {
        agentName: "resistanceAgent",
        input: {
          task: input.task
        },
        output: resistanceResult,
        summary: `Detected resistance type: ${resistanceResult.resistance_type}.`
      });

      const refinedResistance =
        memoryResult.memories.length > 0
          ? classifyResistanceType({
              task: input.task,
              memories: memoryResult.memories
            })
          : resistanceResult.resistance_type;

      if (refinedResistance !== resistanceResult.resistance_type) {
        await recordStep(writable, agentRunId, {
          agentName: "coordinator",
          stepKind: "decision",
          input: {
            original: resistanceResult.resistance_type,
            memories: memoryResult.memories
          },
          output: {
            refined: refinedResistance
          },
          summary: "Coordinator refined the resistance type using retrieved memories."
        });
      }

      let selectedMicroAction = await dependencies.microActionAgent({
        task: input.task,
        memories: memoryResult.memories,
        resistance_type: refinedResistance,
        avoid_action: input.avoidMicroAction ?? null
      });
      await recordStep(writable, agentRunId, {
        agentName: "microActionAgent",
        input: {
          task: input.task,
          memories_count: memoryResult.memories.length,
          resistance_type: refinedResistance
        },
        output: selectedMicroAction,
        summary: "Generated the initial low-friction start step."
      });

      let reviewResult = await dependencies.reviewAgent({
        task: input.task,
        resistance_type: refinedResistance,
        micro_action: selectedMicroAction
      });
      await recordStep(writable, agentRunId, {
        agentName: "reviewAgent",
        input: {
          task: input.task,
          resistance_type: refinedResistance
        },
        output: reviewResult,
        summary: reviewResult.summary
      });

      let recoveryApplied = false;

      if (!reviewResult.approved) {
        recoveryApplied = true;
        await recordStep(writable, agentRunId, {
          agentName: "coordinator",
          stepKind: "handoff",
          input: {
            issues: reviewResult.issues,
            score: reviewResult.score
          },
          summary: "Coordinator routed the draft to recoveryAgent for a safer restart step."
        });

        const recoveredMicroAction = await dependencies.recoveryAgent({
          task: input.task,
          memories: memoryResult.memories,
          resistance_type: refinedResistance,
          issues: reviewResult.issues
        });
        await recordStep(writable, agentRunId, {
          agentName: "recoveryAgent",
          input: {
            task: input.task,
            issues: reviewResult.issues,
            resistance_type: refinedResistance
          },
          output: recoveredMicroAction,
          summary: "Recovery agent generated a smaller fallback step."
        });

        const recoveredReview = await dependencies.reviewAgent({
          task: input.task,
          resistance_type: refinedResistance,
          micro_action: recoveredMicroAction
        });
        await recordStep(writable, agentRunId, {
          agentName: "reviewAgent",
          stepKind: "decision",
          input: {
            pass: "recovered"
          },
          output: recoveredReview,
          summary: recoveredReview.summary
        });

        if (recoveredReview.approved || recoveredReview.score >= reviewResult.score) {
          selectedMicroAction = recoveredMicroAction;
          reviewResult = recoveredReview;
        }
      }

      const schedule = await dependencies.schedulerAgent({
        micro_action: selectedMicroAction.micro_action,
        estimated_minutes: selectedMicroAction.estimated_minutes,
        userPreferences: input.userPreferences,
        energyLevel: input.energyLevel,
        taskDeadline: input.taskDeadline ?? null,
        availableTimeToday: input.availableTimeToday,
        workStyle: input.workStyle ?? null
      });
      await recordStep(writable, agentRunId, {
        agentName: "schedulerAgent",
        input: {
          estimated_minutes: selectedMicroAction.estimated_minutes,
          energy_level: input.energyLevel,
          task_deadline: input.taskDeadline ?? null,
          available_time_today: input.availableTimeToday ?? null
        },
        output: schedule,
        summary: "Scheduler chose the next realistic focus slot."
      });

      const finalOutput: GenerateMicroActionOutput = {
        ...memoryResult,
        resistance_type: refinedResistance,
        ...selectedMicroAction,
        schedule,
        review: reviewResult,
        recovery_applied: recoveryApplied,
        agent_run_id: agentRunId
      };

      await recordRunUpdate(writable, agentRunId, {
        status: "completed",
        sharedState: {
          ...sharedState,
          memory_result: memoryResult,
          resistance_type: refinedResistance,
          review: reviewResult,
          recovery_applied: recoveryApplied
        },
        finalOutput,
        completedAt: new Date().toISOString()
      });

      return finalOutput;
    } catch (error) {
      await recordStep(writable, agentRunId, {
        agentName: "coordinator",
        stepKind: "error",
        status: "failed",
        output: {
          message: error instanceof Error ? error.message : "Unknown error"
        },
        summary: "Coordinator failed before a complete plan could be produced."
      });
      await recordRunUpdate(writable, agentRunId, {
        status: "failed",
        sharedState,
        finalOutput: {
          error: error instanceof Error ? error.message : "Unknown error"
        },
        completedAt: new Date().toISOString()
      });
      throw error;
    }
  };
}

export const generateMicroActionPlan = createGenerateMicroActionPlan();
