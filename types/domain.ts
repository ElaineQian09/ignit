import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type MicroAction = Database["public"]["Tables"]["micro_actions"]["Row"];
export type MemoryChunk = Database["public"]["Tables"]["memory_chunks"]["Row"];
export type UserSchedulePreferences =
  Database["public"]["Tables"]["user_schedule_preferences"]["Row"];
export type ScheduledBlock =
  Database["public"]["Tables"]["scheduled_blocks"]["Row"];
export type MemoryLog = Database["public"]["Tables"]["memory_logs"]["Row"];

export const WORK_STYLE_OPTIONS = [
  "Structured",
  "Flexible",
  "Sprint-based",
  "Needs external prompts"
] as const;

export const AVOIDANCE_OPTIONS = [
  "Task feels too large",
  "Too many choices",
  "Fear of doing it badly",
  "Hard to restart after context switching",
  "Avoids open-ended writing",
  "Energy crashes in the afternoon"
] as const;

export const ENERGY_LEVEL_OPTIONS = ["low", "medium", "high"] as const;
export const WEEKDAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;

export type WorkStyle = (typeof WORK_STYLE_OPTIONS)[number];
export type EnergyLevel = (typeof ENERGY_LEVEL_OPTIONS)[number];
export type Weekday = (typeof WEEKDAY_OPTIONS)[number];

export interface TimePeriod {
  start_time: string;
  end_time: string;
}

export interface TaskWithRelations extends Task {
  goal_title?: string | null;
  plans: PlanWithRelations[];
  micro_actions: MicroAction[];
}

export interface PlanWithRelations extends Plan {
  micro_actions: MicroAction[];
}

export interface DashboardAction extends MicroAction {
  task_title: string;
  goal_title?: string | null;
}

export interface TodayScheduledBlock extends ScheduledBlock {
  task_title?: string | null;
  goal_title?: string | null;
  action_text?: string | null;
  estimated_minutes?: number | null;
  micro_action_status?: MicroAction["status"] | null;
}

export interface CompletionStats {
  current_streak_days: number;
  completed_micro_actions_today: number;
  completed_micro_actions_this_week: number;
  completed_micro_actions_total: number;
}
