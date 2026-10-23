import { NextResponse } from "next/server";
import { requireRecruiter } from "../../../../lib/auth";
import { decryptGoogleToken, getGoogleConnection } from "../../../../lib/google";

export async function POST(request) {
  const { recruiter, supabase } = await requireRecruiter();
  const connection = await getGoogleConnection(supabase, recruiter.id);

  if (connection) {
    try {
      const token = decryptGoogleToken(connection.encrypted_refresh_token);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        cache: "no-store"
      });
    } catch {
      // Delete the local connection even if Google revocation is unavailable.
    }

    const { error } = await supabase
      .from("google_connections")
      .delete()
      .eq("recruiter_id", recruiter.id);

    if (error) throw error;
  }

  return NextResponse.redirect(new URL("/admin/integrations?disconnected=1", request.url), 303);
}
