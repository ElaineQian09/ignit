import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeInternalPath } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));
  const redirectTo = request.nextUrl.clone();

  redirectTo.pathname = "/login";
  redirectTo.searchParams.delete("code");
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (!tokenHash && !code) {
    redirectTo.searchParams.set("error", "Missing verification code.");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type
        })
      : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    console.error("Magic link verification failed:", {
      message: error.message,
      hasTokenHash: Boolean(tokenHash),
      hasCode: Boolean(code),
      type
    });
    redirectTo.searchParams.set(
      "error",
      `Magic link verification failed: ${error.message}`
    );
    return NextResponse.redirect(redirectTo);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(redirectTo);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("work_style")
    .eq("user_id", user.id)
    .maybeSingle<Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "work_style"
    >>();

  const destination = profile?.work_style ? next : "/onboarding";

  return NextResponse.redirect(new URL(destination, request.url));
}
