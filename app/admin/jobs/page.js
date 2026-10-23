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
        <h2>Create a role</h2>
        <form action={createJob} className="stack-form">
          <div className="form-grid">
            <label>Title<input name="title" required /></label>
            <label>Department<input name="department" /></label>
            <label>Client name<input name="client_name" /></label>
            <label>Hiring manager<input name="hiring_manager" /></label>
            <label>Client contact<input name="client_contact" /></label>
            <label>Status
              <select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label>Location<input name="location" /></label>
            <label>Workplace<input name="workplace" placeholder="Remote, Hybrid, On-site" /></label>
            <label>Employment type<input name="employment_type" /></label>
            <label>Compensation<input name="compensation" /></label>
          </div>
          <label>Public summary<textarea name="short_summary" rows="2" /></label>
          <label>Description<textarea name="description" rows="4" /></label>
          <label>Responsibilities<textarea name="responsibilities" rows="4" /></label>
          <label>Requirements<textarea name="requirements" rows="4" /></label>
          <label>Interview stages<textarea name="interview_stages" rows="4" placeholder={"Recruiter Screen\nHiring Manager\nPanel\nFinal"} /></label>
          <label>Internal notes<textarea name="internal_notes" rows="3" /></label>
          <button type="submit">Create role</button>
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
