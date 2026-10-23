import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { createJob } from "../actions";

export default async function JobsPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, department, client_name, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Jobs</p>
          <h1>Active searches</h1>
        </div>
      </header>

      <section className="panel">
        <p className="eyebrow">Private role setup</p>
        <h2>Create a role</h2>
        <p className="muted">This creates the internal search only. You can prepare and publish the public posting from the role page.</p>

        <form action={createJob} className="stack-form">
          <div className="form-grid">
            <label>Internal role title<input name="title" required /></label>
            <label>Department<input name="department" /></label>
            <label>Client name<input name="client_name" /></label>
            <label>Hiring manager<input name="hiring_manager" /></label>
            <label>Client contact<input name="client_contact" /></label>
          </div>
          <label>Internal notes<textarea name="internal_notes" rows="3" /></label>
          <button type="submit">Create draft role</button>
        </form>
      </section>

      <section className="panel top-gap">
        <h2>Roles</h2>
        {!jobs?.length ? (
          <div className="empty-state">
            <p>No jobs yet.</p>
          </div>
        ) : (
          <div className="table-list">
            {jobs.map((job) => (
              <Link className="table-row" href={`/admin/jobs/${job.id}`} key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <span>{[job.client_name, job.department].filter(Boolean).join(" · ") || "Confidential role"}</span>
                </div>
                <span className="status-pill">{job.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
