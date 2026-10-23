"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export async function login(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/admin/dashboard");

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    redirect("/admin/login?error=invalid-login");
  }

  const { data: recruiter } = await supabase
    .from("recruiters")
    .select("id, active")
    .eq("auth_user_id", data.user.id)
    .eq("active", true)
    .maybeSingle();

  if (!recruiter) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not-authorized");
  }

  const safeNext = nextPath.startsWith("/admin/") ? nextPath : "/admin/dashboard";
  redirect(safeNext);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
