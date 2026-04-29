import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIEnv } from "@/lib/env";
import { clamp } from "@/lib/utils";
import type { EnergyLevel, Profile } from "@/types/domain";

interface PlannerInput {
  taskTitle: string;
  goalTitle: string;
  availableTime: number;
  energyLevel: EnergyLevel;
  deadline?: string | null;
  behaviorMemory?: string[];
  profile: Pick<
    Profile,
    "preferred_work_hours" | "work_style" | "common_avoidance_patterns"
  >;
}

interface PlannerOutput {
  action_text: string;
  estimated_minutes: number;
}

const microActionSchema = z.object({
  actions: z
    .array(
      z.object({
        action_text: z.string().min(10).max(220),
        estimated_minutes: z.number().int().min(2).max(20)
      })
    )
    .min(3)
    .max(3)
});

function timerChunk(availableTime: number, energyLevel: EnergyLevel) {
  const base =
    energyLevel === "low" ? 5 : energyLevel === "medium" ? 10 : 15;

  return clamp(Math.min(base, Math.floor(availableTime / 2) || base), 5, 20);
}

function buildSystemPrompt() {
  return `
You are Ignit, a behavioral activation coach that breaks meaningful work into tiny, low-resistance starting moves.

Your job is to generate exactly 3 micro-actions for a single task.

Requirements:
- Optimize for starting, not finishing.
- Make every step specific to the user's actual task and goal. Avoid generic advice.
- The first step must be extremely easy and take under 5 minutes when possible.
- Steps should refer to concrete artifacts, screens, files, sections, or outputs the user can touch immediately.
- Avoid repeating the same template across tasks.
- Respect the user's energy level and available time.
- Avoid vague steps like "get started", "work on it", "make progress", or "brainstorm" unless anchored to a concrete output.
- Keep wording direct and actionable.
- Estimated minutes should be realistic for each step.

Return structured JSON only.
`.trim();
}

function buildUserPrompt({
  taskTitle,
  goalTitle,
  availableTime,
  energyLevel,
  deadline,
  behaviorMemory = [],
  profile
}: PlannerInput) {
  const avoidancePatterns =
    profile.common_avoidance_patterns?.length
      ? profile.common_avoidance_patterns.join(", ")
      : "None provided";
  const memorySection =
    behaviorMemory.length > 0
      ? `Recent work history:\n- ${behaviorMemory.join("\n- ")}`
      : "Recent work history: None yet";

  return `
Generate 3 low-resistance micro-actions for this user.

Goal: ${goalTitle}
Task: ${taskTitle}
Available time: ${availableTime} minutes
Energy level: ${energyLevel}
Deadline: ${deadline ?? "None"}
Preferred work hours: ${profile.preferred_work_hours ?? "Unknown"}
Work style: ${profile.work_style ?? "Unknown"}
Common avoidance patterns: ${avoidancePatterns}
${memorySection}

Good output characteristics:
- Tailor the steps to this exact task, not a generic productivity template.
- Use the user's avoidance patterns to reduce friction.
- Reuse proven timing patterns from recent work history when they seem relevant.
- If the user often finishes quickly after a certain kind of start, prefer that shape.
- If the task is writing-heavy, make the first step about opening or extracting a concrete subsection.
- If the task is ambiguous, reduce ambiguity by naming a small visible deliverable.
- If the task sounds emotionally loaded, make the first step safer and easier.
- Keep the sequence coherent: step 1 should make step 2 easier, and step 2 should make step 3 easier.

Bad output characteristics:
- Reusing boilerplate phrases regardless of task.
- Listing broad planning advice instead of physical next moves.
- Making all 3 tasks the same shape for every user.
`.trim();
}

function deterministicFallback({
  taskTitle,
  availableTime,
  energyLevel,
  profile
}: Pick<
  PlannerInput,
  "taskTitle" | "availableTime" | "energyLevel" | "profile"
>): PlannerOutput[] {
  const startMinutes = timerChunk(availableTime, energyLevel);
  const prepMinutes = clamp(Math.round(startMinutes / 2), 2, 10);
  const memoryNudge = profile.common_avoidance_patterns?.[0]
    ? ` Reduce friction from this pattern: ${profile.common_avoidance_patterns[0]}.`
    : "";

  const secondAction =
    energyLevel === "low"
      ? `Open the exact file, tab, or document needed for "${taskTitle}" and stop once it is visible.${memoryNudge}`
      : energyLevel === "medium"
        ? `List the first three visible sub-steps for "${taskTitle}" without trying to finish them.${memoryNudge}`
        : `Do the easiest concrete slice of "${taskTitle}" for one short pass.${memoryNudge}`;

  return [
    {
      action_text: `Write one sentence that defines what "started" means for "${taskTitle}".`,
      estimated_minutes: prepMinutes
    },
    {
      action_text: secondAction,
      estimated_minutes: startMinutes
    },
    {
      action_text: `Set a ${startMinutes}-minute timer, work only until it ends, then decide whether to continue.`,
      estimated_minutes: startMinutes
    }
  ];
}

function normalizeActions(
  actions: Array<{ action_text: string; estimated_minutes: number }>,
  availableTime: number
) {
  const maxStepMinutes = clamp(Math.max(Math.floor(availableTime), 2), 2, 20);

  return actions.map((action) => ({
    action_text: action.action_text.trim(),
    estimated_minutes: clamp(action.estimated_minutes, 2, maxStepMinutes)
  }));
}

export async function generateMicroActions(
  input: PlannerInput
): Promise<PlannerOutput[]> {
  const { apiKey, model } = getOpenAIEnv();

  if (!apiKey) {
    return deterministicFallback(input);
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.parse({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: buildUserPrompt(input)
        }
      ],
      text: {
        format: zodTextFormat(microActionSchema, "micro_actions")
      }
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      return deterministicFallback(input);
    }

    return normalizeActions(parsed.actions, input.availableTime);
  } catch (error) {
    console.error("OpenAI micro-action generation failed:", error);
    return deterministicFallback(input);
  }
}
