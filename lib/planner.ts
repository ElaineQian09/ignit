import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIEnv } from "@/lib/env";
import { clamp } from "@/lib/utils";
import type { EnergyLevel, Profile, WorkStyle } from "@/types/domain";

interface PlannerInput {
  taskTitle: string;
  planTitle?: string | null;
  goalTitle: string;
  availableTime: number;
  energyLevel: EnergyLevel;
  deadline?: string | null;
  behaviorMemory?: string[];
  preferredWorkWindow?: string | null;
  profile: Pick<
    Profile,
    "work_style" | "common_avoidance_patterns"
  >;
}

interface PlannerOutput {
  action_text: string;
  estimated_minutes: number;
}

function describeWorkStyle(workStyle: WorkStyle | null | undefined) {
  switch (workStyle) {
    case "Structured":
      return "Use a clear sequence, explicit deliverables, and low ambiguity between steps.";
    case "Flexible":
      return "Offer room to choose an entry point and avoid overly rigid instructions.";
    case "Sprint-based":
      return "Favor short bursts, visible progress, and actions that fit inside a focused sprint.";
    case "Needs external prompts":
      return "Use strong external triggers like timers, reminders, or visible cues to help the user start.";
    default:
      return "Keep the steps concrete and easy to start.";
  }
}

function availableSprintMinutes(startMinutes: number) {
  if (startMinutes >= 15) {
    return 15;
  }

  if (startMinutes >= 10) {
    return 10;
  }

  return 8;
}

function getWorkStyleMinutes(
  workStyle: WorkStyle | null | undefined,
  startMinutes: number
) {
  switch (workStyle) {
    case "Structured":
      return {
        prep: clamp(Math.min(startMinutes, 5), 2, 5),
        action: clamp(startMinutes, 5, 20),
        close: clamp(Math.min(startMinutes, 10), 5, 15)
      };
    case "Flexible":
      return {
        prep: clamp(Math.min(startMinutes, 4), 2, 4),
        action: clamp(Math.max(6, startMinutes - 2), 5, 18),
        close: clamp(Math.min(startMinutes, 8), 4, 12)
      };
    case "Sprint-based":
      return {
        prep: clamp(Math.min(startMinutes, 3), 2, 3),
        action: clamp(Math.min(availableSprintMinutes(startMinutes), 20), 8, 20),
        close: clamp(Math.min(startMinutes, 5), 3, 5)
      };
    case "Needs external prompts":
      return {
        prep: clamp(Math.min(startMinutes, 3), 2, 3),
        action: clamp(Math.min(startMinutes, 8), 5, 10),
        close: clamp(Math.min(startMinutes, 4), 2, 5)
      };
    default:
      return {
        prep: clamp(Math.round(startMinutes / 2), 2, 10),
        action: startMinutes,
        close: startMinutes
      };
  }
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
  planTitle,
  goalTitle,
  availableTime,
  energyLevel,
  deadline,
  behaviorMemory = [],
  preferredWorkWindow,
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
  const workStyleGuidance = describeWorkStyle(profile.work_style as WorkStyle | null);

  return `
Generate 3 low-resistance micro-actions for this user.

Goal: ${goalTitle}
Task: ${taskTitle}
Current plan: ${planTitle ?? taskTitle}
Available time: ${availableTime} minutes
Energy level: ${energyLevel}
Deadline: ${deadline ?? "None"}
Preferred work window: ${preferredWorkWindow ?? "Unknown"}
Work style: ${profile.work_style ?? "Unknown"}
Work style guidance: ${workStyleGuidance}
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
- Make the action shape match the user's work style instead of using one generic pattern.

Bad output characteristics:
- Reusing boilerplate phrases regardless of task.
- Listing broad planning advice instead of physical next moves.
- Making all 3 tasks the same shape for every user.
`.trim();
}

function deterministicFallback({
  taskTitle,
  planTitle,
  availableTime,
  energyLevel,
  profile
}: Pick<
  PlannerInput,
  "taskTitle" | "planTitle" | "availableTime" | "energyLevel" | "profile"
>): PlannerOutput[] {
  const workingTitle = planTitle ?? taskTitle;
  const startMinutes = timerChunk(availableTime, energyLevel);
  const minutes = getWorkStyleMinutes(
    profile.work_style as WorkStyle | null,
    startMinutes
  );
  const memoryNudge = profile.common_avoidance_patterns?.[0]
    ? ` Reduce friction from this pattern: ${profile.common_avoidance_patterns[0]}.`
    : "";
  const workStyle = profile.work_style as WorkStyle | null;

  switch (workStyle) {
    case "Structured":
      return [
        {
          action_text: `Write a 3-step checklist for "${workingTitle}" and label step 1 as the smallest visible start.${memoryNudge}`,
          estimated_minutes: minutes.prep
        },
        {
          action_text: `Complete only step 1 of the checklist for "${workingTitle}" and stop when that exact sub-step is done.${memoryNudge}`,
          estimated_minutes: minutes.action
        },
        {
          action_text: `Record the next exact step for "${workingTitle}" in one sentence so the restart path stays clear.`,
          estimated_minutes: minutes.close
        }
      ];
    case "Flexible":
      return [
        {
          action_text: `Open the main file, tab, or document for "${workingTitle}" and note two possible ways to begin.${memoryNudge}`,
          estimated_minutes: minutes.prep
        },
        {
          action_text: `Choose the easier of those two entry points and work on it for one short pass only.${memoryNudge}`,
          estimated_minutes: minutes.action
        },
        {
          action_text: `Leave a quick note about what feels most natural to continue next on "${workingTitle}".`,
          estimated_minutes: minutes.close
        }
      ];
    case "Sprint-based":
      return [
        {
          action_text: `Pick one narrow target inside "${workingTitle}" that can move in a single sprint.${memoryNudge}`,
          estimated_minutes: minutes.prep
        },
        {
          action_text: `Set a ${minutes.action}-minute sprint and push only that narrow target until the timer ends.${memoryNudge}`,
          estimated_minutes: minutes.action
        },
        {
          action_text: `Capture the next sprint target for "${workingTitle}" before you step away.`,
          estimated_minutes: minutes.close
        }
      ];
    case "Needs external prompts":
      return [
        {
          action_text: `Set a visible timer and place the exact file, tab, or tool for "${workingTitle}" on screen before doing anything else.${memoryNudge}`,
          estimated_minutes: minutes.prep
        },
        {
          action_text: `When the timer starts, do the easiest concrete slice of "${workingTitle}" until it rings.${memoryNudge}`,
          estimated_minutes: minutes.action
        },
        {
          action_text: `Create one external restart cue for later, like a calendar note or pinned reminder naming the next action.`,
          estimated_minutes: minutes.close
        }
      ];
    default: {
      const secondAction =
        energyLevel === "low"
          ? `Open the exact file, tab, or document needed for "${workingTitle}" and stop once it is visible.${memoryNudge}`
          : energyLevel === "medium"
            ? `List the first three visible sub-steps for "${workingTitle}" without trying to finish them.${memoryNudge}`
            : `Do the easiest concrete slice of "${workingTitle}" for one short pass.${memoryNudge}`;

      return [
        {
          action_text: `Write one sentence that defines what "started" means for "${workingTitle}".`,
          estimated_minutes: minutes.prep
        },
        {
          action_text: secondAction,
          estimated_minutes: minutes.action
        },
        {
          action_text: `Set a ${minutes.action}-minute timer, work only until it ends, then decide whether to continue.`,
          estimated_minutes: minutes.close
        }
      ];
    }
  }
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
