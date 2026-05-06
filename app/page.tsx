import { redirect } from "next/navigation";

import { getProfile, requireUser } from "@/lib/auth";

export default async function HomePage() {
  const { user } = await requireUser();
  const profile = await getProfile(user.id);

  if (!profile?.work_style) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
