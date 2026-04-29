import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type MicroAction = Database["public"]["Tables"]["micro_actions"]["Row"];
export type MemoryChunk = Database["public"]["Tables"]["memory_chunks"]["Row"];

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

export type WorkStyle = (typeof WORK_STYLE_OPTIONS)[number];
export type EnergyLevel = (typeof ENERGY_LEVEL_OPTIONS)[number];

export interface TaskWithRelations extends Task {
  goal_title?: string | null;
  micro_actions: MicroAction[];
}

export interface DashboardAction extends MicroAction {
  task_title: string;
  goal_title?: string | null;
}

