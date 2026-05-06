export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          preferred_work_days: string[] | null;
          max_daily_focus_minutes: number | null;
          preferred_session_length: number | null;
          break_length: number | null;
          low_energy_time_periods: string[] | null;
          high_energy_time_periods: string[] | null;
          work_style: string | null;
          common_avoidance_patterns: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_work_days?: string[] | null;
          max_daily_focus_minutes?: number | null;
          preferred_session_length?: number | null;
          break_length?: number | null;
          low_energy_time_periods?: string[] | null;
          high_energy_time_periods?: string[] | null;
          work_style?: string | null;
          common_avoidance_patterns?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferred_work_days?: string[] | null;
          max_daily_focus_minutes?: number | null;
          preferred_session_length?: number | null;
          break_length?: number | null;
          low_energy_time_periods?: string[] | null;
          high_energy_time_periods?: string[] | null;
          work_style?: string | null;
          common_avoidance_patterns?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_schedule_preferences: {
        Row: {
          id: string;
          user_id: string;
          preferred_days: string[] | null;
          preferred_start_time: string | null;
          preferred_end_time: string | null;
          max_daily_focus_minutes: number | null;
          preferred_session_minutes: number | null;
          break_minutes: number | null;
          high_energy_periods: Json | null;
          low_energy_periods: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_days?: string[] | null;
          preferred_start_time?: string | null;
          preferred_end_time?: string | null;
          max_daily_focus_minutes?: number | null;
          preferred_session_minutes?: number | null;
          break_minutes?: number | null;
          high_energy_periods?: Json | null;
          low_energy_periods?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferred_days?: string[] | null;
          preferred_start_time?: string | null;
          preferred_end_time?: string | null;
          max_daily_focus_minutes?: number | null;
          preferred_session_minutes?: number | null;
          break_minutes?: number | null;
          high_energy_periods?: Json | null;
          low_energy_periods?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_schedule_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          deadline: string | null;
          status: "active" | "paused" | "done";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          deadline?: string | null;
          status?: "active" | "paused" | "done";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          deadline?: string | null;
          status?: "active" | "paused" | "done";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          title: string;
          deadline: string | null;
          available_time_minutes: number | null;
          status: "active" | "done" | "archived";
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          title: string;
          deadline?: string | null;
          available_time_minutes?: number | null;
          status?: "active" | "done" | "archived";
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string;
          title?: string;
          deadline?: string | null;
          available_time_minutes?: number | null;
          status?: "active" | "done" | "archived";
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      plans: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          status: "active" | "queued" | "done" | "archived";
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          status?: "active" | "queued" | "done" | "archived";
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          status?: "active" | "queued" | "done" | "archived";
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      micro_actions: {
        Row: {
          id: string;
          task_id: string;
          plan_id: string;
          action_text: string;
          estimated_minutes: number;
          status: "pending" | "done" | "skipped";
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          plan_id: string;
          action_text: string;
          estimated_minutes: number;
          status?: "pending" | "done" | "skipped";
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          plan_id?: string;
          action_text?: string;
          estimated_minutes?: number;
          status?: "pending" | "done" | "skipped";
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "micro_actions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "micro_actions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      memory_chunks: {
        Row: {
          id: string;
          user_id: string;
          source_type: "task_history" | "reflection" | "manual_note";
          content: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: "task_history" | "reflection" | "manual_note";
          content: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: "task_history" | "reflection" | "manual_note";
          content?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_chunks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      scheduled_blocks: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          micro_action_id: string | null;
          start_time: string;
          end_time: string;
          status:
            | "scheduled"
            | "in_progress"
            | "completed"
            | "skipped"
            | "rescheduled"
            | "cancelled";
          schedule_reason: string | null;
          rescheduled_from_block_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          micro_action_id?: string | null;
          start_time: string;
          end_time: string;
          status?:
            | "scheduled"
            | "in_progress"
            | "completed"
            | "skipped"
            | "rescheduled"
            | "cancelled";
          schedule_reason?: string | null;
          rescheduled_from_block_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          micro_action_id?: string | null;
          start_time?: string;
          end_time?: string;
          status?:
            | "scheduled"
            | "in_progress"
            | "completed"
            | "skipped"
            | "rescheduled"
            | "cancelled";
          schedule_reason?: string | null;
          rescheduled_from_block_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_blocks_rescheduled_from_block_id_fkey";
            columns: ["rescheduled_from_block_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_blocks_micro_action_id_fkey";
            columns: ["micro_action_id"];
            isOneToOne: false;
            referencedRelation: "micro_actions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_blocks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_blocks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      memory_logs: {
        Row: {
          id: string;
          user_id: string;
          event_type:
            | "schedule_success"
            | "schedule_failure"
            | "block_completed"
            | "block_skipped"
            | "block_rescheduled"
            | "block_need_more_time";
          summary: string;
          metadata: Json | null;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type:
            | "schedule_success"
            | "schedule_failure"
            | "block_completed"
            | "block_skipped"
            | "block_rescheduled"
            | "block_need_more_time";
          summary: string;
          metadata?: Json | null;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?:
            | "schedule_success"
            | "schedule_failure"
            | "block_completed"
            | "block_skipped"
            | "block_rescheduled"
            | "block_need_more_time";
          summary?: string;
          metadata?: Json | null;
          embedding?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_memory_logs: {
        Args: {
          query_embedding: string;
          match_user_id: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          summary: string;
          event_type: string;
          metadata: Json | null;
          created_at: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
