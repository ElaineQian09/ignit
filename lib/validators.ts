import { z } from "zod";

import { ENERGY_LEVEL_OPTIONS, WORK_STYLE_OPTIONS } from "@/types/domain";

const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const TIME_RANGE_PATTERN =
  /^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

export const onboardingSchema = z.object({
  bigGoals: z.string().min(3, "Add at least one goal."),
  workStyle: z.enum(WORK_STYLE_OPTIONS),
  commonAvoidancePatterns: z
    .array(z.string())
    .min(1, "Pick at least one avoidance pattern.")
});

export const scheduleSchema = z.object({
  preferredWorkDays: z
    .array(z.string())
    .min(1, "Pick at least one preferred work day."),
  preferredStartTime: z
    .string()
    .regex(TIME_VALUE_PATTERN, "Choose a valid preferred start time."),
  preferredEndTime: z
    .string()
    .regex(TIME_VALUE_PATTERN, "Choose a valid preferred end time."),
  maxDailyFocusMinutes: z.coerce
    .number()
    .int()
    .min(30, "Daily focus minutes must be at least 30.")
    .max(720, "Daily focus minutes must be 720 or less."),
  preferredSessionMinutes: z.coerce
    .number()
    .int()
    .min(5, "Preferred session length must be at least 5.")
    .max(180, "Preferred session length must be 180 or less."),
  breakMinutes: z.coerce
    .number()
    .int()
    .min(1, "Break length must be at least 1 minute.")
    .max(60, "Break length must be 60 or less."),
  lowEnergyTimePeriods: z
    .array(z.string().regex(TIME_RANGE_PATTERN, "Use HH:MM-HH:MM format."))
    .default([]),
  highEnergyTimePeriods: z
    .array(z.string().regex(TIME_RANGE_PATTERN, "Use HH:MM-HH:MM format."))
    .default([])
}).refine(
  (value) => value.preferredStartTime < value.preferredEndTime,
  {
    message: "Preferred end time must be after preferred start time.",
    path: ["preferredEndTime"]
  }
);

export const scheduleRequestSchema = z.object({
  task_id: z.string().uuid("Invalid task id."),
  micro_actions: z
    .array(
      z.object({
        id: z.string().uuid("Invalid micro action id."),
        action_text: z.string().min(1, "Action text is required."),
        estimated_minutes: z.number().int().min(1).max(180)
      })
    )
    .min(1, "At least one micro action is required."),
  deadline: z.string().optional(),
  available_time_today: z.number().int().min(5).max(720),
  energy_level: z.enum(ENERGY_LEVEL_OPTIONS)
});

export const generateMicroActionRequestSchema = z.object({
  task: z.string().min(3, "Task is too short."),
  deadline: z.string().optional(),
  available_time_today: z.number().int().min(5).max(720).optional(),
  energy_level: z.enum(ENERGY_LEVEL_OPTIONS)
});

export const taskSchema = z.object({
  goalId: z.string().uuid("Select a goal."),
  title: z.string().min(3, "Task title is too short."),
  planTitles: z.string().optional(),
  deadline: z.string().optional(),
  availableTime: z.coerce
    .number()
    .int()
    .min(5, "Available time must be at least 5 minutes.")
    .max(180, "Available time must be 180 minutes or less."),
  energyLevel: z.enum(ENERGY_LEVEL_OPTIONS)
});

export const taskAvailableTimeSchema = z.object({
  taskId: z.string().uuid("Invalid task."),
  availableTime: z.coerce
    .number()
    .int()
    .min(5, "Available time must be at least 5 minutes.")
    .max(180, "Available time must be 180 minutes or less.")
});
