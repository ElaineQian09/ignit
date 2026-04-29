"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getBaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators";

export async function sendMagicLink(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    redirect("/login?error=Please%20enter%20a%20valid%20email.");
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getBaseUrl(origin)}/auth/confirm?next=/dashboard`
    }
  });

  if (error) {
    redirect("/login?error=Unable%20to%20send%20magic%20link.");
  }

  redirect("/login?success=Check%20your%20email%20for%20the%20magic%20link.");
}

