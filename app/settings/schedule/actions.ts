"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { splitToList } from "@/lib/utils";
import { scheduleSchema } from "@/lib/validators";

function toScheduleValidationMessage(fieldErrors: Record<string, string[] | undefined>) {
  if (fieldErrors.preferredEndTime?.some((message) =>
    message.includes("after preferred start time")
  )) {
    return "Preferred end time must be after preferred start time.";
  }

  if (fieldErrors.lowEnergyTimePeriods || fieldErrors.highEnergyTimePeriods) {
    return "Use HH:MM-HH:MM for low-energy and high-energy time periods.";
  }

  const firstMessage = Object.values(fieldErrors)
    .flatMap((messages) => messages ?? [])
    .find(Boolean);

  if (firstMessage) {
    return firstMessage;
  }

  return "Unable to save schedule. Check the entered values and try again.";
}

function toScheduleSaveErrorMessage(message: string) {
  if (message.includes("user_schedule_preferences")) {
    return "Schedule preferences table is missing. Run the latest Supabase migrations.";
  }

  if (message.includes("violates check constraint")) {
    return "One of the schedule values is outside the allowed range.";
  }

  return `Unable to save schedule: ${message}`;
}

function toTimePeriods(values: string[]) {
  return values.map((value) => {
    const [startTime, endTime] = value.split("-").map((item) => item.trim());

    return {
      start_time: startTime,
      end_time: endTime
    };
  });
}

function normalizeTimeValue(value: string) {
  return value.slice(0, 5);
}

export async function saveSchedule(formData: FormData) {
  const parsed = scheduleSchema.safeParse({
    preferredWorkDays: formData.getAll("preferredWorkDays"),
    preferredStartTime: formData.get("preferredStartTime"),
    preferredEndTime: formData.get("preferredEndTime"),
    maxDailyFocusMinutes: formData.get("maxDailyFocusMinutes"),
    preferredSessionMinutes: formData.get("preferredSessionMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    lowEnergyTimePeriods: splitToList(
      String(formData.get("lowEnergyTimePeriods") ?? "")
    ),
    highEnergyTimePeriods: splitToList(
      String(formData.get("highEnergyTimePeriods") ?? "")
    )
  });

  if (!parsed.success) {
    redirect(
      `/settings/schedule?error=${encodeURIComponent(
        toScheduleValidationMessage(parsed.error.flatten().fieldErrors)
      )}`
    );
  }

  const normalizedStartTime = normalizeTimeValue(parsed.data.preferredStartTime);
  const normalizedEndTime = normalizeTimeValue(parsed.data.preferredEndTime);

  const { supabase, user } = await requireUser();
  const writable = supabase as unknown as {
    from: (table: string) => {
      upsert: (
        values: unknown,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
      insert: (
        values: unknown
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: scheduleError } = await writable
    .from("user_schedule_preferences")
    .upsert(
    {
      user_id: user.id,
      preferred_days: parsed.data.preferredWorkDays,
      preferred_start_time: normalizedStartTime,
      preferred_end_time: normalizedEndTime,
      max_daily_focus_minutes: parsed.data.maxDailyFocusMinutes,
      preferred_session_minutes: parsed.data.preferredSessionMinutes,
      break_minutes: parsed.data.breakMinutes,
      low_energy_periods: toTimePeriods(parsed.data.lowEnergyTimePeriods),
      high_energy_periods: toTimePeriods(parsed.data.highEnergyTimePeriods)
    },
    {
      onConflict: "user_id"
    }
  );

  if (scheduleError) {
    redirect(
      `/settings/schedule?error=${encodeURIComponent(
        toScheduleSaveErrorMessage(scheduleError.message)
      )}`
    );
  }
  await writable.from("memory_chunks").insert({
    user_id: user.id,
    source_type: "manual_note",
    content: `Schedule updated. Work days: ${parsed.data.preferredWorkDays.join(", ")}. Focus window: ${normalizedStartTime}-${normalizedEndTime}. Daily cap: ${parsed.data.maxDailyFocusMinutes} minutes. Session length: ${parsed.data.preferredSessionMinutes} minutes. Break length: ${parsed.data.breakMinutes} minutes.`,
    metadata: {
      source: "schedule_settings",
      low_energy_periods: toTimePeriods(parsed.data.lowEnergyTimePeriods),
      high_energy_periods: toTimePeriods(parsed.data.highEnergyTimePeriods)
    }
  });

  revalidatePath("/settings/schedule");
  revalidatePath("/dashboard");
  redirect("/settings/schedule?success=Schedule%20saved.");
}
