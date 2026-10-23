function encode(value) {
  return encodeURIComponent(String(value || ""));
}

function googleDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function mailtoUrl({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${to || ""}?${params.toString()}`;
}

export function gmailComposeUrl({ to, subject, body }) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1"
  });
  if (to) params.set("to", to);
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function googleCalendarUrl({
  title,
  start,
  durationMinutes = 30,
  details,
  location,
  guestEmail
}) {
  if (!start) return null;

  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + Number(durationMinutes || 30) * 60000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Interview",
    dates: `${googleDate(startDate)}/${googleDate(endDate)}`
  });

  if (details) params.set("details", details);
  if (location) params.set("location", location);
  if (guestEmail) params.set("add", guestEmail);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
