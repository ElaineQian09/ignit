import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserSchedulePreferences } from "@/types/domain";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return (data ?? null) as Profile | null;
}

export async function getSchedulePreferences(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_schedule_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return (data ?? null) as UserSchedulePreferences | null;
}

export async function requireOnboardedUser() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = (data ?? null) as Profile | null;

  if (!profile?.work_style) {
    redirect("/onboarding");
  }

  return { supabase, user, profile };
}
