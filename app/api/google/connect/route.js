import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRecruiter } from "../../../../lib/auth";
import { googleConfigured, googleRedirectUri, googleScopes } from "../../../../lib/google";

export async function GET(request) {
  await requireRecruiter();

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/admin/integrations?error=google-not-configured", request.url));
  }

  const state = randomBytes(32).toString("hex");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    scope: googleScopes().join(" ")
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set("jvr_google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });

  return response;
}
