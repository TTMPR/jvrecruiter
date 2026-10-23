import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import { updateApplicationStage } from "../../actions";

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

  const interviewStages = Array.isArray(job.interview_stages) ? job.interview_stages : [];

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <Link className="back-link" href="/admin/jobs">← Jobs</Link>
          <h1>{job.title}</h1>
          <p className="muted">{job.client_name || "Confidential client"} · {job.status}</p>
        </div>
      </header>

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

      <section className="panel top-gap">
        <h2>Public posting</h2>
        {job.job_posts?.[0] ? (
          <p>
            {job.job_posts[0].published ? "Published" : "Not published"} ·
            {" "}<Link href={`/jobs/${job.job_posts[0].slug}`}>View public page</Link>
          </p>
        ) : <p>No public post.</p>}
      </section>
    </AdminShell>
  );
}
