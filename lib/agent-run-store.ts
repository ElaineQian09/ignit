import type { Json } from "@/types/database";

type AgentRunStatus = "running" | "completed" | "failed" | "cancelled";
type AgentStepKind = "agent_result" | "handoff" | "decision" | "error";
type AgentStepStatus = "pending" | "completed" | "failed" | "skipped";
type AgentTriggerSource =
  | "task_creation"
  | "api_generate_micro_action"
  | "schedule_recovery"
  | "manual_replan";

type InsertChain = Promise<{ error: { message: string } | null }> & {
  select: (columns: string) => {
    single: () => Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  };
};

type WritableClient = {
  from: (table: string) => {
    insert: (values: unknown) => InsertChain;
    update: (values: unknown) => {
      eq: (
        column: string,
        value: string
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function toJson(value: unknown): Json | null {
  if (value === undefined) {
    return null;
  }

  return value as Json;
}

export interface StartAgentRunInput {
  userId: string;
  taskId?: string | null;
  planId?: string | null;
  workflow?: string;
  triggerSource: AgentTriggerSource;
  input?: unknown;
  sharedState?: unknown;
}

export interface AppendAgentStepInput {
  runId: string;
  agentName: string;
  stepKind?: AgentStepKind;
  status?: AgentStepStatus;
  input?: unknown;
  output?: unknown;
  summary?: string;
}

export async function startAgentRun(
  writable: WritableClient,
  input: StartAgentRunInput
) {
  try {
    const { data, error } = await writable
      .from("agent_runs")
      .insert({
        user_id: input.userId,
        task_id: input.taskId ?? null,
        plan_id: input.planId ?? null,
        workflow: input.workflow ?? "micro_action_planning",
        trigger_source: input.triggerSource,
        status: "running" as const,
        input: toJson(input.input),
        shared_state: toJson(input.sharedState ?? {}) ?? {}
      })
      .select("id")
      .single();

    if (error) {
      console.error("Unable to start agent run:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error("Unable to start agent run:", error);
    return null;
  }
}

export async function appendAgentStep(
  writable: WritableClient,
  input: AppendAgentStepInput
) {
  try {
    const { error } = await writable.from("agent_steps").insert({
      agent_run_id: input.runId,
      agent_name: input.agentName,
      step_kind: input.stepKind ?? "agent_result",
      status: input.status ?? "completed",
      input: toJson(input.input),
      output: toJson(input.output),
      summary: input.summary ?? null
    });

    if (error) {
      console.error("Unable to append agent step:", error.message);
    }
  } catch (error) {
    console.error("Unable to append agent step:", error);
  }
}

export async function updateAgentRun(
  writable: WritableClient,
  runId: string,
  values: {
    status?: AgentRunStatus;
    sharedState?: unknown;
    finalOutput?: unknown;
    completedAt?: string | null;
  }
) {
  try {
    const { error } = await writable
      .from("agent_runs")
      .update({
        ...(values.status ? { status: values.status } : {}),
        ...(values.sharedState !== undefined
          ? { shared_state: toJson(values.sharedState ?? {}) ?? {} }
          : {}),
        ...(values.finalOutput !== undefined
          ? { final_output: toJson(values.finalOutput) }
          : {}),
        ...(values.completedAt !== undefined
          ? { completed_at: values.completedAt }
          : {})
      })
      .eq("id", runId);

    if (error) {
      console.error("Unable to update agent run:", error.message);
    }
  } catch (error) {
    console.error("Unable to update agent run:", error);
  }
}
