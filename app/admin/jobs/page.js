import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";

export default async function JobsPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, department, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Jobs</p>
          <h1>Active searches</h1>
        </div>
        <button className="primary-button">New job</button>
      </header>

      <section className="panel">
        {!jobs?.length ? (
          <div className="empty-state">
            <h2>No jobs yet.</h2>
            <p>Create the first confidential search when you are ready.</p>
          </div>
        ) : (
          <div className="table-list">
            {jobs.map((job) => (
              <div className="table-row" key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <span>{job.department || "No department"}</span>
                </div>
                <span className="status-pill">{job.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
