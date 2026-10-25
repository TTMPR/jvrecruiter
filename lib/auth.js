import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function requireRecruiter() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/admin/login");
  }

  const { data: recruiter } = await supabase
    .from("recruiters")
    .select("id, name, email, role, active, organization_id")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!recruiter) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not-authorized");
  }

  return { user, recruiter, supabase };
}
