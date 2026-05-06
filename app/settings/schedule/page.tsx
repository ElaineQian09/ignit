import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormNotice } from "@/components/forms/form-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/utils";
import {
  WEEKDAY_OPTIONS,
  type TimePeriod,
  type UserSchedulePreferences
} from "@/types/domain";

import { saveSchedule } from "./actions";

interface ScheduleSettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatPeriodList(periods: TimePeriod[] | null | undefined) {
  return (periods ?? [])
    .map((period) => `${period.start_time}-${period.end_time}`)
    .join("\n");
}

export default async function ScheduleSettingsPage({
  searchParams
}: ScheduleSettingsPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const success = firstQueryValue(params.success);
  let error = firstQueryValue(params.error);

  const { data, error: preferencesError } = await supabase
    .from("user_schedule_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!error && preferencesError) {
    error = preferencesError.message.includes("user_schedule_preferences")
      ? "Schedule preferences table is missing. Run the latest Supabase migrations."
      : preferencesError.message;
  }
  const preferences = (data ?? null) as UserSchedulePreferences | null;

  return (
    <AppShell>
      <div className="py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Settings
            </span>
            <h1 className="mt-3 text-4xl font-semibold">Schedule preferences</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Define when focused work is realistic so Ignit can plan around your
              actual capacity, not an idealized schedule.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-[var(--border)] bg-white/60 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form action={saveSchedule} className="surface rounded-[2rem] p-6 sm:p-8">
            <FormNotice message={success} tone="success" />
            <FormNotice message={error} tone="error" />

            <div className="mt-4 space-y-6">
              <fieldset>
                <legend className="label">Preferred work days</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const checked =
                      preferences?.preferred_days?.includes(day) ?? false;

                    return (
                      <label
                        key={day}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="preferredWorkDays"
                          value={day}
                          defaultChecked={checked}
                          className="mt-1 h-4 w-4 rounded border-neutral-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span>{day}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Pick at least one day when Ignit is allowed to place focused work.
                </p>
              </fieldset>

              <div>
                <label className="label">Preferred work window</label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="preferredStartTime"
                      className="mb-2 block text-sm text-[var(--muted)]"
                    >
                      Start time
                    </label>
                    <input
                      id="preferredStartTime"
                      name="preferredStartTime"
                      type="time"
                      defaultValue={preferences?.preferred_start_time ?? "20:00"}
                      className="field"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="preferredEndTime"
                      className="mb-2 block text-sm text-[var(--muted)]"
                    >
                      End time
                    </label>
                    <input
                      id="preferredEndTime"
                      name="preferredEndTime"
                      type="time"
                      defaultValue={preferences?.preferred_end_time ?? "23:00"}
                      className="field"
                      required
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Example: You work best from 20:00 to 23:00.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="maxDailyFocusMinutes" className="label">
                    Max daily focus minutes
                  </label>
                  <input
                    id="maxDailyFocusMinutes"
                    name="maxDailyFocusMinutes"
                    type="number"
                    min={30}
                    max={720}
                    step={5}
                    defaultValue={preferences?.max_daily_focus_minutes ?? 120}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="preferredSessionMinutes" className="label">
                    Preferred session length
                  </label>
                  <input
                    id="preferredSessionMinutes"
                    name="preferredSessionMinutes"
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    defaultValue={preferences?.preferred_session_minutes ?? 25}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="breakMinutes" className="label">
                    Break length
                  </label>
                  <input
                    id="breakMinutes"
                    name="breakMinutes"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    defaultValue={preferences?.break_minutes ?? 5}
                    className="field"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="lowEnergyTimePeriods" className="label">
                    Low-energy time periods
                  </label>
                  <textarea
                    id="lowEnergyTimePeriods"
                    name="lowEnergyTimePeriods"
                    rows={5}
                    defaultValue={formatPeriodList(
                      (preferences?.low_energy_periods as TimePeriod[] | null) ?? null
                    )}
                    placeholder={"13:00-15:00\n16:30-17:00"}
                    className="field resize-none"
                  />
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    One period per line in `HH:MM-HH:MM` format.
                  </p>
                </div>
                <div>
                  <label htmlFor="highEnergyTimePeriods" className="label">
                    High-energy time periods
                  </label>
                  <textarea
                    id="highEnergyTimePeriods"
                    name="highEnergyTimePeriods"
                    rows={5}
                    defaultValue={formatPeriodList(
                      (preferences?.high_energy_periods as TimePeriod[] | null) ?? null
                    )}
                    placeholder={"20:00-22:00\n09:00-10:00"}
                    className="field resize-none"
                  />
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    One period per line in `HH:MM-HH:MM` format.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <SubmitButton label="Save schedule" pendingLabel="Saving..." />
            </div>
          </form>

          <aside className="space-y-6">
            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">Example setup</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <li>Preferred work window: 20:00 to 23:00.</li>
                <li>Preferred session length: 25 minutes.</li>
                <li>Max daily focus: 120 minutes.</li>
                <li>Break length: 5 minutes.</li>
              </ul>
            </div>

            <div className="surface rounded-[2rem] p-6">
              <h2 className="text-xl font-semibold">Why this matters</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                These settings give the planner clearer bounds for daily capacity,
                safer session sizing, and better timing hints when the retrieval
                layer grows into calendar-aware scheduling.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
