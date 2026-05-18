import type { MemoryAgentOutput } from "@/lib/agents/memoryAgent";
import type {
  MicroActionAgentOutput
} from "@/lib/agents/microActionAgent";
import type { ResistanceType } from "@/lib/agents/resistanceAgent";

export interface RecoveryAgentInput {
  task: string;
  memories: MemoryAgentOutput["memories"];
  resistance_type: ResistanceType;
  issues: string[];
}

function isInterviewQuestionPrep(task: string) {
  const normalized = task.toLowerCase();
  return normalized.includes("interview") && normalized.includes("question");
}

export async function recoveryAgent(
  input: RecoveryAgentInput
): Promise<MicroActionAgentOutput> {
  const memoryHint = input.memories[0]?.trim();
  const task = input.task.trim();
  const interviewQuestionPrep = isInterviewQuestionPrep(task);

  switch (input.resistance_type) {
    case "task_too_large":
      return {
        micro_action: interviewQuestionPrep
          ? `Open a note for "${task}" and list three questions an interviewer could ask about one project.`
          : `Open a note for "${task}" and write only the first sub-step you can see.`,
        estimated_time: "3 minutes",
        estimated_minutes: 3,
        why_this_step: "It turns a broad task into one visible edge without requiring a full breakdown.",
        optional_next_step: interviewQuestionPrep
          ? `Choose the easiest interview question from "${task}" and draft a one-sentence answer skeleton.`
          : `Pick the easiest listed sub-step for "${task}" and prepare it for two more minutes.`,
        confidence: 0.9
      };
    case "decision_overload":
      return {
        micro_action: `Write down two ways to start "${task}", then cross out one and keep the easier option.`,
        estimated_time: "4 minutes",
        estimated_minutes: 4,
        why_this_step: "It compresses a many-option problem into a single safe choice.",
        optional_next_step: "Spend three minutes on the remaining option only.",
        confidence: 0.88
      };
    case "fear_of_failure":
      return {
        micro_action: interviewQuestionPrep
          ? `Write one intentionally rough answer to a single likely question from "${task}" in a scratch note.`
          : `Create a scratch version for "${task}" and label it "rough start" before adding one imperfect line.`,
        estimated_time: "4 minutes",
        estimated_minutes: 4,
        why_this_step: "It separates starting from quality judgment and lowers performance pressure.",
        optional_next_step: interviewQuestionPrep
          ? `Underline one sentence from the rough interview answer for "${task}" that you would keep in a real answer.`
          : `Keep one usable line from the rough start for "${task}" and rewrite it clearly.`,
        confidence: 0.87
      };
    case "fear_of_difficulty":
      return {
        micro_action: `Open the easiest part of "${task}" and skim it for four minutes without solving the hardest part yet.`,
        estimated_time: "4 minutes",
        estimated_minutes: 4,
        why_this_step: "It creates a low-stakes first contact with difficult work.",
        optional_next_step: `Mark one small section of "${task}" that now feels approachable.`,
        confidence: 0.86
      };
    case "fatigue":
      return {
        micro_action: `Do the lightest setup step for "${task}": open the needed file or tab and leave it ready.`,
        estimated_time: "1 minute",
        estimated_minutes: 1,
        why_this_step: "Low energy needs a setup move that preserves momentum without demanding output.",
        optional_next_step: `If energy improves, spend two more minutes on the easiest visible slice of "${task}".`,
        confidence: 0.92
      };
    default:
      return {
        micro_action: memoryHint
          ? `Repeat the kind of small restart that worked before: ${memoryHint}`
          : `Open the main workspace for "${task}" and make one tiny visible change.`,
        estimated_time: "2 minutes",
        estimated_minutes: 2,
        why_this_step: "A safer recovery step should be concrete enough to start immediately.",
        optional_next_step: `Do one extra tiny action for "${task}" only if it still feels easy.`,
        confidence: 0.85
      };
  }
}
