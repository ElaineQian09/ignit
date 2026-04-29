import { NextResponse } from "next/server";

import { safeInternalPath } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=Missing%20verification%20code.", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=Magic%20link%20verification%20failed.", request.url)
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_work_hours, work_style")
    .eq("user_id", user.id)
    .maybeSingle<Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "preferred_work_hours" | "work_style"
    >>();

  const destination =
    profile?.preferred_work_hours && profile.work_style ? next : "/onboarding";

  return NextResponse.redirect(new URL(destination, request.url));
}
