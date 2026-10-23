import { NextResponse } from "next/server";
import { requireRecruiter } from "../../../../lib/auth";
import {
  encryptGoogleToken,
  googleConfigured,
  googleRedirectUri,
  getGoogleConnection
} from "../../../../lib/google";

export async function GET(request) {
  const { recruiter, supabase } = await requireRecruiter();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = request.cookies.get("jvr_google_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/admin/integrations?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!googleConfigured() || !code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/admin/integrations?error=invalid-google-oauth", request.url));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) {
    return NextResponse.redirect(new URL("/admin/integrations?error=google-token-exchange", request.url));
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store"
  });
  const profile = await profileResponse.json();

  const existing = await getGoogleConnection(supabase, recruiter.id);
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptGoogleToken(tokens.refresh_token)
    : existing?.encrypted_refresh_token;

  if (!encryptedRefreshToken) {
    return NextResponse.redirect(new URL("/admin/integrations?error=missing-refresh-token", request.url));
  }

  const { error: saveError } = await supabase.from("google_connections").upsert({
    recruiter_id: recruiter.id,
    google_email: profile.email || existing?.google_email || null,
    encrypted_refresh_token: encryptedRefreshToken,
    scopes: String(tokens.scope || "").split(" ").filter(Boolean),
    updated_at: new Date().toISOString()
  }, { onConflict: "recruiter_id" });

  if (saveError) throw saveError;

  const response = NextResponse.redirect(new URL("/admin/integrations?connected=1", request.url));
  response.cookies.set("jvr_google_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
