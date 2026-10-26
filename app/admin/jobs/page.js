import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { createJob } from "../actions";

export default async function JobsPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, department, client_name, updated_at, job_posts(slug,published)")
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
          <div className="job-list">
            {jobs.map((job) => {
              const post = job.job_posts?.[0];
              return (
                <article className="job-list-card" key={job.id}>
                  <Link className="job-list-main" href={`/admin/jobs/${job.id}`}>
                    <div>
                      <strong>{job.title}</strong>
                      <span>{[job.client_name, job.department].filter(Boolean).join(" · ") || "Confidential role"}</span>
                    </div>
                    <span className={post?.published ? "status-pill published" : "status-pill"}>
                      {post?.published ? "Live" : job.status}
                    </span>
                  </Link>
                  <div className="job-list-actions">
                    <Link className="secondary-button" href={`/admin/jobs/${job.id}#role-editor`}>Edit role</Link>
                    <Link className="secondary-button" href={`/admin/jobs/${job.id}#pipeline`}>Pipeline</Link>
                    {post?.published && post.slug ? (
                      <Link className="secondary-button" href={`/jobs/${post.slug}`} target="_blank">View posting</Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
