import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import { addCandidateNote, attachCandidateToJob, updateApplicationStage } from "../../actions";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];

export default async function CandidateDetailPage({ params }) {
  const { id } = await params;
  const { recruiter, supabase } = await requireRecruiter();

  const { data: candidate } = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
  if (!candidate) notFound();

  const [{ data: applications }, { data: notes }, { data: jobs }] = await Promise.all([
    supabase.from("applications")
      .select("id, stage, interview_stage, job:jobs(id,title)")
      .eq("candidate_id", id)
      .order("updated_at", { ascending:false }),
    supabase.from("candidate_notes")
      .select("id, body, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending:false }),
    supabase.from("jobs")
      .select("id,title,status")
      .in("status", ["draft","published","paused"])
      .order("updated_at", { ascending:false })
  ]);

  const existingJobIds = new Set((applications || []).map((a) => a.job?.id));
  const availableJobs = (jobs || []).filter((job) => !existingJobIds.has(job.id));

  let resumeUrl = null;
  if (candidate.latest_resume_path) {
    const { data } = await supabase.storage
      .from("resumes")
      .createSignedUrl(candidate.latest_resume_path, 300, { download: candidate.latest_resume_name || true });
    resumeUrl = data?.signedUrl || null;
  }

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <Link className="back-link" href="/admin/candidates">← Candidates</Link>
          <h1>{candidate.full_name}</h1>
          <p className="muted">{[candidate.current_title, candidate.current_company, candidate.location].filter(Boolean).join(" · ")}</p>
        </div>
        {resumeUrl ? <a className="primary-button" href={resumeUrl}>Open résumé</a> : null}
      </header>

      <div className="two-column">
        <section className="panel">
          <h2>Profile</h2>
          <dl className="detail-list">
            <div><dt>Email</dt><dd>{candidate.email || "—"}</dd></div>
            <div><dt>Phone</dt><dd>{candidate.phone || "—"}</dd></div>
            <div><dt>LinkedIn</dt><dd>{candidate.linkedin_url ? <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">Open profile</a> : "—"}</dd></div>
            <div><dt>Source</dt><dd>{candidate.source}</dd></div>
            <div><dt>Résumé</dt><dd>{candidate.latest_resume_name || "—"}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <h2>Notes</h2>
          <form action={addCandidateNote} className="stack-form">
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <textarea name="body" rows="3" placeholder="Add note..." required />
            <button type="submit">Add note</button>
          </form>
          <div className="notes-list">
            {(notes || []).map((note) => (
              <article key={note.id}><p>{note.body}</p><span>{new Date(note.created_at).toLocaleDateString()}</span></article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel top-gap">
        <h2>Add to a role</h2>
        {availableJobs.length ? (
          <form action={attachCandidateToJob} className="inline-form">
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <select name="job_id" required>
              <option value="">Select a role</option>
              {availableJobs.map((job) => <option value={job.id} key={job.id}>{job.title} · {job.status}</option>)}
            </select>
            <button type="submit">Add to role</button>
          </form>
        ) : <p className="muted">No additional active roles available.</p>}
      </section>

      <section className="panel top-gap">
        <h2>Processes</h2>
        <div className="table-list">
          {(applications || []).map((app) => (
            <div className="table-row" key={app.id}>
              <div>
                <Link href={`/admin/jobs/${app.job.id}`}><strong>{app.job.title}</strong></Link>
                <span>{app.interview_stage || app.stage}</span>
              </div>
              <form action={updateApplicationStage} className="inline-form">
                <input type="hidden" name="application_id" value={app.id} />
                <select name="stage" defaultValue={app.stage}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
                <button type="submit">Update</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
