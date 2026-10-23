import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events"
];

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://jvrecruiter.xyz").replace(/\/$/, "");
}

export function googleRedirectUri() {
  return `${appUrl()}/api/google/callback`;
}

export function googleScopes() {
  return GOOGLE_SCOPES;
}

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
}

function encryptionKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptGoogleToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(payload) {
  const [ivValue, tagValue, encryptedValue] = String(payload || "").split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Google token");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export async function getGoogleConnection(supabase, recruiterId) {
  const { data, error } = await supabase
    .from("google_connections")
    .select("id,recruiter_id,google_email,encrypted_refresh_token,scopes,connected_at,updated_at")
    .eq("recruiter_id", recruiterId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getGoogleAccessToken(supabase, recruiterId) {
  if (!googleConfigured()) throw new Error("Google integration is not configured");

  const connection = await getGoogleConnection(supabase, recruiterId);
  if (!connection) throw new Error("Google account is not connected");

  const refreshToken = decryptGoogleToken(connection.encrypted_refresh_token);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Unable to refresh Google access token");
  }

  return { accessToken: payload.access_token, connection };
}

function mimeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject || "", "utf8").toString("base64")}?=`;
}

export async function sendGoogleEmail({ supabase, recruiterId, to, subject, body }) {
  const { accessToken } = await getGoogleAccessToken(supabase, recruiterId);

  const mime = [
    `To: ${to}`,
    `Subject: ${mimeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body || ""
  ].join("\r\n");

  const raw = Buffer.from(mime, "utf8").toString("base64url");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Unable to send email through Gmail");
  }

  return payload;
}

export async function createGoogleCalendarEvent({
  supabase,
  recruiterId,
  summary,
  description,
  start,
  durationMinutes = 30,
  meetingUrl,
  attendeeEmail
}) {
  const { accessToken } = await getGoogleAccessToken(supabase, recruiterId);

  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + Number(durationMinutes || 30) * 60000);

  const event = {
    summary,
    description: description || undefined,
    start: { dateTime: startDate.toISOString(), timeZone: "America/Puerto_Rico" },
    end: { dateTime: endDate.toISOString(), timeZone: "America/Puerto_Rico" },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
    location: meetingUrl || undefined
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event),
      cache: "no-store"
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Unable to create Google Calendar event");
  }

  return payload;
}
