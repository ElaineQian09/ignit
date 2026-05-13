import type { MicroActionAgentOutput } from "@/lib/agents/microActionAgent";
import type { ResistanceType } from "@/lib/agents/resistanceAgent";

export interface ReviewAgentInput {
  task: string;
  resistance_type: ResistanceType;
  micro_action: MicroActionAgentOutput;
}

export interface ReviewAgentOutput {
  approved: boolean;
  score: number;
  issues: string[];
  summary: string;
}

const GENERIC_STARTS = [
  "start",
  "work on",
  "continue",
  "prepare",
  "make progress",
  "focus on"
];

const CONCRETE_VERBS = [
  "open",
  "write",
  "list",
  "review",
  "rename",
  "collect",
  "scan",
  "draft",
  "highlight",
  "pick",
  "set",
  "create"
];

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export async function reviewAgent(
  input: ReviewAgentInput
): Promise<ReviewAgentOutput> {
  const issues: string[] = [];
  const action = input.micro_action.micro_action.trim();
  const normalized = action.toLowerCase();

  if (input.micro_action.estimated_minutes > 5) {
    issues.push("The step is longer than the low-friction target window.");
  }

  if (action.length > 140) {
    issues.push("The step is too wordy and may feel harder to start.");
  }

  if (includesAny(normalized, GENERIC_STARTS)) {
    issues.push("The step starts with generic language instead of a concrete action.");
  }

  if (!includesAny(normalized, CONCRETE_VERBS)) {
    issues.push("The step lacks a concrete visible verb.");
  }

  if (
    input.resistance_type === "task_too_large" &&
    !includesAny(normalized, ["open", "list", "pick", "review", "write"])
  ) {
    issues.push("For a large task, the step should shrink the surface area faster.");
  }

  if (input.micro_action.confidence < 0.65) {
    issues.push("The generation confidence is low enough to warrant a safer fallback.");
  }

  return {
    approved: issues.length === 0,
    score: Math.max(0, 1 - issues.length * 0.18),
    issues,
    summary:
      issues.length === 0
        ? "The step is concrete, short, and realistic to start."
        : "The step needs tightening before it should be shown as the next move."
  };
}
