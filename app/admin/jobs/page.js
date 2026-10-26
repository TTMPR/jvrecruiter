import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import NewRoleButton from "../new-role-button";

export default async function JobsPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params?.q || "").trim().toLowerCase();
  const status = String(params?.status || "active");
  const sort = String(params?.sort || "recent");
  const { recruiter, supabase } = await requireRecruiter();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, department, client_name, updated_at, job_posts(slug,published)")
    .order("updated_at", { ascending: sort !== "oldest" });

  const visibleJobs = (jobs || []).filter((job) => {
    const post = Array.isArray(job.job_posts) ? job.job_posts[0] : job.job_posts;
    const haystack = [job.title, job.client_name, job.department].filter(Boolean).join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
    if (status === "live" && !post?.published) return false;
    if (status === "draft" && (post?.published || job.status !== "draft")) return false;
    if (status === "closed" && job.status !== "closed") return false;
    if (status === "active" && job.status === "closed") return false;
    return true;
  });

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Jobs</p>
          <h1>Active searches</h1>
        </div>
        <div className="header-actions">
          <details className="filter-popover">
            <summary>Filter & sort</summary>
            <div className="filter-popover-panel">
              <form method="get" className="filter-grid compact-filter-grid">
                <label>Search
                  <input name="q" defaultValue={params?.q || ""} placeholder="Role, client, department..." />
                </label>
                <label>Status
                  <select name="status" defaultValue={status}>
                    <option value="active">Active</option>
                    <option value="live">Live</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <label>Sort
                  <select name="sort" defaultValue={sort}>
                    <option value="recent">Recently updated</option>
                    <option value="oldest">Oldest updated</option>
                  </select>
                </label>
                <div className="filter-actions">
                  <button type="submit">Apply</button>
                  <Link className="secondary-button" href="/admin/jobs">Clear</Link>
                </div>
              </form>
            </div>
          </details>
          <NewRoleButton />
        </div>
      </header>

      <section className="panel">
        <h2>Roles</h2>
        {!visibleJobs.length ? (
          <div className="empty-state">
            <p>No jobs yet.</p>
          </div>
        ) : (
          <div className="job-list">
            {visibleJobs.map((job) => {
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
