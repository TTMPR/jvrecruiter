import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import NewRoleButton from "../new-role-button";

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
        <NewRoleButton />
      </header>

      <section className="panel">
        <h2>Roles</h2>
        {!jobs?.length ? (
          <div className="empty-state">
            <p>No jobs yet.</p>
          </div>
        ) : (
          <div className="job-list">
            {jobs.map((job) => {
              const post = Array.isArray(job.job_posts) ? job.job_posts[0] : job.job_posts;
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
                    <Link className="secondary-button" href={`/admin/jobs/${job.id}/edit`}>Edit JD</Link>
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
