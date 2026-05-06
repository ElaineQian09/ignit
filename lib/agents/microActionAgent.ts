import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIEnv } from "@/lib/env";
import type { ResistanceType } from "@/lib/agents/resistanceAgent";

export interface MicroActionAgentInput {
  task: string;
  memories: string[];
  resistance_type: ResistanceType;
}

export interface MicroActionAgentOutput {
  micro_action: string;
  estimated_time: string;
  estimated_minutes: number;
  why_this_step: string;
  optional_next_step: string;
  confidence: number;
}

const microActionSchema = z.object({
  micro_action: z.string().min(10).max(220),
  estimated_time: z.string().min(3).max(30),
  why_this_step: z.string().min(10).max(220),
  optional_next_step: z.string().min(10).max(220),
  confidence: z.number().min(0).max(1)
});

function formatMinutes(minutes: number) {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function fallbackMicroAction(
  task: string,
  resistanceType: ResistanceType
): MicroActionAgentOutput {
  switch (resistanceType) {
    case "task_too_large":
      return {
        micro_action: `Open a note for "${task}" and list only the first visible sub-step you could touch right now.`,
        estimated_time: formatMinutes(3),
        estimated_minutes: 3,
        why_this_step: "It shrinks a broad task into one concrete edge without asking for a full plan.",
        optional_next_step: "Circle the easiest sub-step and spend two more minutes setting it up.",
        confidence: 0.76
      };
    case "unclear_start":
      return {
        micro_action: `Open the exact file, tab, or document you would need first for "${task}" and leave it on screen.`,
        estimated_time: formatMinutes(2),
        estimated_minutes: 2,
        why_this_step: "It removes startup ambiguity and turns the task into a visible workspace.",
        optional_next_step: "Write one sentence describing what “started” would look like here.",
        confidence: 0.74
      };
    case "fear_of_difficulty":
      return {
        micro_action: `Set a 4-minute timer and skim only the easiest section of "${task}" without solving the hard part yet.`,
        estimated_time: formatMinutes(4),
        estimated_minutes: 4,
        why_this_step: "It lowers threat by creating a safe first contact instead of demanding full performance.",
        optional_next_step: "Highlight one small part that now feels less intimidating.",
        confidence: 0.73
      };
    case "fear_of_failure":
      return {
        micro_action: `Create a rough scratch version of the first part of "${task}" and label it “messy draft”.`,
        estimated_time: formatMinutes(5),
        estimated_minutes: 5,
        why_this_step: "It separates starting from judging quality, which reduces performance pressure.",
        optional_next_step: "Keep only one line or bullet that feels usable and ignore the rest.",
        confidence: 0.72
      };
    case "fatigue":
      return {
        micro_action: `Do the lightest setup move for "${task}": open the needed tab or document and place it where you can return later.`,
        estimated_time: formatMinutes(1),
        estimated_minutes: 1,
        why_this_step: "Low energy calls for a tiny setup action that keeps momentum without overload.",
        optional_next_step: "If energy improves, spend two more minutes on the easiest visible slice.",
        confidence: 0.81
      };
    case "decision_overload":
      return {
        micro_action: `Write down the first two possible ways to start "${task}", then pick the easier one and ignore the other.`,
        estimated_time: formatMinutes(4),
        estimated_minutes: 4,
        why_this_step: "It cuts choice overload down to a simple binary decision.",
        optional_next_step: "Work on the chosen option for three minutes only.",
        confidence: 0.75
      };
    default:
      return {
        micro_action: `Open the main workspace for "${task}" and make one tiny visible mark that shows you started.`,
        estimated_time: formatMinutes(2),
        estimated_minutes: 2,
        why_this_step: "The first move should be concrete, visible, and easy enough to do immediately.",
        optional_next_step: "Stay for one more tiny action if it still feels light.",
        confidence: 0.7
      };
  }
}

function buildPrompt(input: MicroActionAgentInput) {
  const memorySection =
    input.memories.length > 0
      ? `Relevant memories:\n- ${input.memories.join("\n- ")}`
      : "Relevant memories: none";

  return `
Generate one ultra-low-friction starting action for this task.

Task: ${input.task}
Resistance type: ${input.resistance_type}
${memorySection}

Requirements:
- Return exactly one starting action.
- The action must be concrete and specific.
- It must take 30 seconds to 5 minutes.
- It must reduce cognitive load.
- Do not ask the user to restate the task.
- Do not output generic motivation advice.
- Keep the optional next step small too.
`.trim();
}

export async function microActionAgent(
  input: MicroActionAgentInput
): Promise<MicroActionAgentOutput> {
  const { apiKey, model } = getOpenAIEnv();

  if (!apiKey) {
    return fallbackMicroAction(input.task, input.resistance_type);
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.parse({
      model,
      input: [
        {
          role: "system",
          content:
            "You generate a single concrete start step for a stuck user. Keep it specific, tiny, and immediately actionable."
        },
        {
          role: "user",
          content: buildPrompt(input)
        }
      ],
      text: {
        format: zodTextFormat(microActionSchema, "micro_action")
      }
    });
    const parsed = response.output_parsed;

    if (!parsed) {
      return fallbackMicroAction(input.task, input.resistance_type);
    }

    const estimatedMinutes = Math.max(
      1,
      Math.min(
        5,
        Number.parseInt(parsed.estimated_time.replace(/[^\d]/g, ""), 10) || 3
      )
    );

    return {
      ...parsed,
      estimated_time: formatMinutes(estimatedMinutes),
      estimated_minutes: estimatedMinutes
    };
  } catch (error) {
    console.error("Micro-action agent failed:", error);
    return fallbackMicroAction(input.task, input.resistance_type);
  }
}
