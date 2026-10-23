import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import { updateApplicationStage, updateJob, updateJobStatus } from "../../actions";

const MAIN_STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed"];

export default async function JobDetailPage({ params }) {
  const { id } = await params;
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: job }, { data: applications }] = await Promise.all([
    supabase.from("jobs").select("*, job_posts(*)").eq("id", id).maybeSingle(),
    supabase.from("applications")
      .select("id, stage, interview_stage, applied_at, candidate:candidates(id, full_name, current_title, current_company, location)")
      .eq("job_id", id)
      .order("updated_at", { ascending: false })
  ]);

  if (!job) notFound();

  const post = job.job_posts?.[0] || {};
  const interviewStages = Array.isArray(job.interview_stages) ? job.interview_stages : [];

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <Link className="back-link" href="/admin/jobs">← Jobs</Link>
          <h1>{job.title}</h1>
          <p className="muted">{job.client_name || "Confidential client"} · {job.status}</p>
        </div>
        <form action={updateJobStatus} className="inline-form">
          <input type="hidden" name="job_id" value={job.id} />
          <select name="status" defaultValue={job.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit">Update status</button>
        </form>
      </header>

      <section className="panel">
        <h2>Edit role</h2>
        <form action={updateJob} className="stack-form">
          <input type="hidden" name="job_id" value={job.id} />
          <div className="form-grid">
            <label>Title<input name="title" defaultValue={job.title || ""} required /></label>
            <label>Department<input name="department" defaultValue={job.department || ""} /></label>
            <label>Client name<input name="client_name" defaultValue={job.client_name || ""} /></label>
            <label>Hiring manager<input name="hiring_manager" defaultValue={job.hiring_manager || ""} /></label>
            <label>Client contact<input name="client_contact" defaultValue={job.client_contact || ""} /></label>
            <label>Location<input name="location" defaultValue={post.location || ""} /></label>
            <label>Workplace<input name="workplace" defaultValue={post.workplace || ""} /></label>
            <label>Employment type<input name="employment_type" defaultValue={post.employment_type || ""} /></label>
            <label>Compensation<input name="compensation" defaultValue={post.compensation || ""} /></label>
          </div>
          <label>Public summary<textarea name="short_summary" rows="2" defaultValue={post.short_summary || ""} /></label>
          <label>Description<textarea name="description" rows="4" defaultValue={post.description || ""} /></label>
          <label>Responsibilities<textarea name="responsibilities" rows="4" defaultValue={post.responsibilities || ""} /></label>
          <label>Requirements<textarea name="requirements" rows="4" defaultValue={post.requirements || ""} /></label>
          <label>Interview stages<textarea name="interview_stages" rows="4" defaultValue={interviewStages.join("\n")} /></label>
          <label>Internal notes<textarea name="internal_notes" rows="3" defaultValue={job.internal_notes || ""} /></label>
          <button type="submit">Save changes</button>
        </form>
      </section>

      <section className="panel top-gap">
        <h2>Pipeline</h2>
        <div className="pipeline">
          {MAIN_STAGES.map((stage) => {
            const items = (applications || []).filter((a) => a.stage === stage);
            return (
              <section className="pipeline-column" key={stage}>
                <div className="pipeline-heading"><strong>{stage}</strong><span>{items.length}</span></div>
                <div className="pipeline-cards">
                  {items.map((app) => (
                    <article className="candidate-card" key={app.id}>
                      <Link href={`/admin/candidates/${app.candidate.id}`}>
                        <strong>{app.candidate.full_name}</strong>
                        <span>{[app.candidate.current_title, app.candidate.current_company].filter(Boolean).join(" · ") || "Candidate"}</span>
                        <span>{app.candidate.location || ""}</span>
                      </Link>
                      <form action={updateApplicationStage} className="stage-form">
                        <input type="hidden" name="application_id" value={app.id} />
                        <select name="stage" defaultValue={app.stage}>
                          {MAIN_STAGES.concat(["Rejected","Withdrawn","Archived"]).map((s) => <option key={s}>{s}</option>)}
                        </select>
                        {stage === "Interviewing" && interviewStages.length ? (
                          <select name="interview_stage" defaultValue={app.interview_stage || ""}>
                            <option value="">Interview step</option>
                            {interviewStages.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : null}
                        <button type="submit">Update</button>
                      </form>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel top-gap">
        <h2>Public posting</h2>
        {post.slug ? (
          <p>
            {post.published ? "Published" : "Not published"} ·
            {" "}<Link href={`/jobs/${post.slug}`}>View public page</Link>
          </p>
        ) : <p>No public post.</p>}
      </section>
    </AdminShell>
  );
}
