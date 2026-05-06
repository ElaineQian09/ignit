export type ResistanceType =
  | "task_too_large"
  | "unclear_start"
  | "fear_of_difficulty"
  | "fear_of_failure"
  | "fatigue"
  | "decision_overload";

export interface ResistanceAgentInput {
  task: string;
  memories?: string[];
}

export interface ResistanceAgentOutput {
  resistance_type: ResistanceType;
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export async function resistanceAgent({
  task,
  memories = []
}: ResistanceAgentInput): Promise<ResistanceAgentOutput> {
  const text = `${task} ${memories.join(" ")}`.toLowerCase();

  if (
    hasAny(text, [
      "low energy",
      "fatigue",
      "tired",
      "exhausted",
      "late night",
      "after 10 pm",
      "energy crash"
    ])
  ) {
    return { resistance_type: "fatigue" };
  }

  if (
    hasAny(text, [
      "too many choices",
      "too many options",
      "choose",
      "decide",
      "decision",
      "which one",
      "pick one"
    ])
  ) {
    return { resistance_type: "decision_overload" };
  }

  if (
    hasAny(text, [
      "afraid",
      "fear",
      "perfect",
      "perfectly",
      "wrong",
      "embarrass",
      "resume",
      "interview",
      "application"
    ])
  ) {
    return { resistance_type: "fear_of_failure" };
  }

  if (
    hasAny(text, [
      "leetcode",
      "technical",
      "hard",
      "difficult",
      "complex",
      "implement",
      "analysis",
      "algorithm"
    ])
  ) {
    return { resistance_type: "fear_of_difficulty" };
  }

  if (
    hasAny(text, [
      "find a job",
      "job search",
      "career",
      "project",
      "launch",
      "build",
      "prepare",
      "organize",
      "plan"
    ]) ||
    task.trim().split(/\s+/).length >= 8
  ) {
    return { resistance_type: "task_too_large" };
  }

  return { resistance_type: "unclear_start" };
}
