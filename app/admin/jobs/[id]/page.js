import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import RichTextEditor from "../../rich-text-editor";
import {
  setPublicPostingState,
  updateApplicationStage,
  updateJob,
  updatePublicPosting
} from "../../actions";

const MAIN_STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed"];

export default async function JobDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
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
  const publishError = query?.publish_error;

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <Link className="back-link" href="/admin/jobs">← Jobs</Link>
          <h1>{job.title}</h1>
          <p className="muted">{job.client_name || "Confidential client"} · {job.status}</p>
        </div>
        <div className="publish-state">
          <span className={post.published ? "status-pill published" : "status-pill"}>
            {post.published ? "Live" : "Not public"}
          </span>
          {post.published && post.slug ? (
            <Link className="secondary-button" href={`/jobs/${post.slug}`} target="_blank">
              View live posting
            </Link>
          ) : null}
        </div>
      </header>

      <div className="two-column job-settings-grid">
        <section className="panel">
          <p className="eyebrow">Internal only</p>
          <h2>Search setup</h2>
          <p className="muted">These details stay inside JVRecruit and are never shown on the public posting.</p>

          <form action={updateJob} className="stack-form">
            <input type="hidden" name="job_id" value={job.id} />
            <label>Internal role title<input name="title" defaultValue={job.title || ""} required /></label>
            <label>Department<input name="department" defaultValue={job.department || ""} /></label>
            <label>Client name<input name="client_name" defaultValue={job.client_name || ""} /></label>
            <label>Hiring manager<input name="hiring_manager" defaultValue={job.hiring_manager || ""} /></label>
            <label>Client contact<input name="client_contact" defaultValue={job.client_contact || ""} /></label>
            <label>Interview stages<textarea name="interview_stages" rows="4" defaultValue={interviewStages.join("\n")} placeholder={"Recruiter Screen\nHiring Manager\nPanel\nFinal"} /></label>
            <label>Internal notes<textarea name="internal_notes" rows="4" defaultValue={job.internal_notes || ""} /></label>
            <button type="submit">Save internal details</button>
          </form>
        </section>

        <section className="panel public-post-panel">
          <p className="eyebrow">Candidate-facing</p>
          <h2>Public posting</h2>
          <p className="muted">Only the fields in this section can appear on jvrecruiter.xyz.</p>

          <form action={updatePublicPosting} className="stack-form">
            <input type="hidden" name="job_id" value={job.id} />
            <label>Public title<input name="public_title" defaultValue={post.title || job.title || ""} required /></label>
            <div className="form-grid">
              <label>Department<input name="department" defaultValue={post.department || job.department || ""} /></label>
              <label>Location<input name="location" defaultValue={post.location || ""} placeholder="Austin, TX / Remote" /></label>
              <label>Workplace
                <select name="workplace" defaultValue={post.workplace || ""}>
                  <option value="">Select</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </label>
              <label>Employment type
                <select name="employment_type" defaultValue={post.employment_type || ""}>
                  <option value="">Select</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </label>
              <label>Compensation<input name="compensation" defaultValue={post.compensation || ""} placeholder="$180k–$220k base" /></label>
            </div>

            <RichTextEditor
              name="short_summary"
              label="Short summary"
              rows={3}
              initialValue={post.short_summary || ""}
              placeholder="A concise overview shown on the Open Roles page."
            />
            <RichTextEditor
              name="description"
              label="About the role"
              rows={7}
              initialValue={post.description || ""}
            />
            <RichTextEditor
              name="responsibilities"
              label="What you'll do"
              rows={7}
              initialValue={post.responsibilities || ""}
            />
            <RichTextEditor
              name="requirements"
              label="What we're looking for"
              rows={7}
              initialValue={post.requirements || ""}
            />
            <button type="submit">Save public posting</button>
          </form>

          <div className="publish-box">
            <div>
              <strong>{post.published ? "This role is live." : "This role is not public."}</strong>
              <p>
                {post.published
                  ? "Candidates can see it under Open Roles and submit an application."
                  : "Save the posting first, then publish when it is ready."}
              </p>
            </div>

            {publishError ? <div className="error-box">{publishError}</div> : null}

            <div className="publish-actions">
              {post.published ? (
                <>
                  <form action={setPublicPostingState}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="intent" value="unpublish" />
                    <button className="secondary-button" type="submit">Unpublish</button>
                  </form>
                  <form action={setPublicPostingState}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="intent" value="close" />
                    <button className="danger-button" type="submit">Close role</button>
                  </form>
                </>
              ) : (
                <form action={setPublicPostingState}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <input type="hidden" name="intent" value="publish" />
                  <button type="submit">Publish role</button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

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
    </AdminShell>
  );
}
