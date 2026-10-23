import { requireRecruiter } from "../../../lib/auth";
import { getGoogleConnection, googleConfigured } from "../../../lib/google";
import AdminShell from "../admin-shell";

export default async function IntegrationsPage({ searchParams }) {
  const params = await searchParams;
  const { recruiter, supabase } = await requireRecruiter();
  const connection = await getGoogleConnection(supabase, recruiter.id);
  const configured = googleConfigured();

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Google Workspace</h1>
          <p className="muted">Connect Gmail and Google Calendar to send and schedule directly from JVRecruit.</p>
        </div>
      </header>

      {params?.connected ? <div className="success-box">Google connected successfully.</div> : null}
      {params?.disconnected ? <div className="success-box">Google disconnected.</div> : null}
      {params?.error ? <div className="error-box">Google connection error: {params.error}</div> : null}

      <section className="panel integration-card">
        <div>
          <p className="eyebrow">Google</p>
          <h2>Gmail + Calendar</h2>
          <p className="muted">
            Send candidate emails, create interview events and keep communication history attached to each candidate.
          </p>
        </div>

        <div className="integration-status">
          {!configured ? (
            <>
              <span className="status-pill">Setup required</span>
              <p className="muted">Google OAuth environment variables still need to be added in Vercel.</p>
            </>
          ) : connection ? (
            <>
              <span className="status-pill published">Connected</span>
              <strong>{connection.google_email || "Google account"}</strong>
              <span className="muted">Connected {new Date(connection.connected_at).toLocaleDateString()}</span>
              <form action="/api/google/disconnect" method="post">
                <button className="danger-button" type="submit">Disconnect Google</button>
              </form>
            </>
          ) : (
            <>
              <span className="status-pill">Not connected</span>
              <a className="primary-button" href="/api/google/connect">Connect Google</a>
            </>
          )}
        </div>
      </section>

      <section className="panel top-gap">
        <h2>What JVRecruit can do after connection</h2>
        <div className="integration-capabilities">
          <article>
            <strong>Send email</strong>
            <span>Send directly through your connected Gmail account.</span>
          </article>
          <article>
            <strong>Create interview events</strong>
            <span>Create Google Calendar events and invite candidates automatically.</span>
          </article>
          <article>
            <strong>Communication history</strong>
            <span>Keep sent emails and calendar events visible on the candidate profile.</span>
          </article>
        </div>
      </section>
    </AdminShell>
  );
}
