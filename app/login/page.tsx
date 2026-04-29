import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormNotice } from "@/components/forms/form-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { firstQueryValue } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

import { sendMagicLink } from "./actions";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const success = firstQueryValue(params.success);
  const error = firstQueryValue(params.error);

  return (
    <AppShell>
      <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <span className="inline-flex rounded-full border border-[var(--border)] bg-white/60 px-4 py-2 text-sm font-medium text-[var(--muted)]">
            Ignit: activation energy planner
          </span>
          <h1 className="max-w-2xl text-5xl font-semibold leading-tight sm:text-6xl">
            Turn resistance into one safe starting move.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">
            Ignit captures memory about how you actually stall, then turns big
            goals into tiny startable actions. The first step should feel easy
            enough to begin, not impressive enough to admire.
          </p>
          <div className="surface max-w-xl rounded-[1.75rem] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Example
            </p>
            <p className="mt-3 text-base leading-7">
              Instead of “refresh all interview topics,” open one old easy
              problem and review your previous thought process for 5 minutes.
            </p>
          </div>
        </section>

        <section className="surface rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Sign in with magic link</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Use email-only authentication so the planner stays low-friction.
            </p>
          </div>

          <div className="space-y-4">
            <FormNotice message={success} tone="success" />
            <FormNotice message={error} tone="error" />
          </div>

          <form action={sendMagicLink} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="field"
                required
              />
            </div>

            <SubmitButton
              label="Send magic link"
              pendingLabel="Sending link..."
              className="w-full"
            />
          </form>

          <p className="mt-6 text-sm leading-6 text-[var(--muted)]">
            After sign-in, you’ll set your work style, common avoidance
            patterns, and the goals that matter right now.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Future RAG memory and scheduling layers plug in behind this same
            flow.
          </p>
          <Link
            href="https://supabase.com/docs/guides/auth"
            className="mt-6 inline-flex text-sm font-medium text-[var(--teal)] hover:text-[var(--accent-strong)]"
          >
            Supabase Auth setup reference
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

