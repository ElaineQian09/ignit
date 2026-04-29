import { z } from "zod";

import { ENERGY_LEVEL_OPTIONS, WORK_STYLE_OPTIONS } from "@/types/domain";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

export const onboardingSchema = z.object({
  bigGoals: z.string().min(3, "Add at least one goal."),
  preferredWorkHours: z
    .string()
    .min(3, "Describe when you usually have usable focus."),
  workStyle: z.enum(WORK_STYLE_OPTIONS),
  commonAvoidancePatterns: z
    .array(z.string())
    .min(1, "Pick at least one avoidance pattern.")
});

export const taskSchema = z.object({
  goalId: z.string().uuid("Select a goal."),
  title: z.string().min(3, "Task title is too short."),
  deadline: z.string().optional(),
  availableTime: z.coerce
    .number()
    .int()
    .min(5, "Available time must be at least 5 minutes.")
    .max(180, "Available time must be 180 minutes or less."),
  energyLevel: z.enum(ENERGY_LEVEL_OPTIONS)
});

