import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import RichTextEditor from "../../rich-text-editor";
import PipelineBoard from "../../pipeline-board";
import {
  createTask,
  saveRoleEditor,
  setPublicPostingState,
  updateTaskStatus
} from "../../actions";

const MAIN_STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed"];

export default async function JobDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: job }, { data: applications }, { data: tasks }, { data: teamRecruiters }] = await Promise.all([
    supabase.from("jobs").select("*, job_posts(*)").eq("id", id).maybeSingle(),
    supabase.from("applications")
      .select("id, stage, interview_stage, disposition, disposition_reason, disposition_at, applied_at, candidate:candidates(id, full_name, current_title, current_company, location), submission:candidate_submissions(id,status,compensation,availability,work_authorization,visa_sponsorship,relocation,submitted_at,updated_at), client_feedback(id,feedback_type,reason,received_at), offers(id,status,base_salary,total_comp,currency,start_date,created_at), placement:placements(id,start_date,placed_compensation,currency,estimated_fee,final_fee,invoice_status,payment_date,guarantee_end_date)")
      .eq("job_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("tasks")
      .select("id,title,task_type,priority,status,due_at,candidate:candidates(id,full_name)")
      .eq("job_id", id)
      .order("status", { ascending:true })
      .order("due_at", { ascending:true, nullsFirst:false }),
    supabase.from("recruiters")
      .select("id,name,email,role")
      .eq("organization_id", recruiter.organization_id)
      .eq("active", true)
      .order("name")
  ]);

  if (!job) notFound();

  const post = job.job_posts?.[0] || {};
  const interviewStages = Array.isArray(job.interview_stages) ? job.interview_stages : [];
  const publishError = query?.publish_error;
  const publishedSuccess = query?.published === "1";
  const savedSuccess = query?.saved === "1";
  const publishMissing = [
    !post.title ? "Public title" : null,
    !post.location ? "Location" : null,
    !post.short_summary ? "Short summary" : null,
    !post.description ? "About the role" : null
  ].filter(Boolean);

  const submittedApps = (applications || []).filter((app) => app.submission?.status === "submitted");
  const advancedCount = (applications || []).filter((app) => app.disposition === "advanced").length;
  const holdCount = (applications || []).filter((app) => app.disposition === "hold").length;
  const rejectedCount = (applications || []).filter((app) => app.disposition === "rejected").length;
  const offerCount = (applications || []).reduce((sum, app) => sum + (app.offers || []).filter((offer) => ["extended","accepted","declined"].includes(offer.status)).length, 0);
  const acceptedOffers = (applications || []).reduce((sum, app) => sum + (app.offers || []).filter((offer) => offer.status === "accepted").length, 0);
  const placements = (applications || []).filter((app) => app.placement);
  const estimatedFees = placements.reduce((sum, app) => sum + Number(app.placement?.estimated_fee || 0), 0);
  const finalFees = placements.reduce((sum, app) => sum + Number(app.placement?.final_fee || 0), 0);

  const reasonCounts = {};
  for (const app of applications || []) {
    for (const feedback of app.client_feedback || []) {
      const reason = String(feedback.reason || "").trim();
      if (!reason) continue;
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0,5);

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

      <section className="role-editor-shell" id="role-editor">
        <div className="role-editor-topbar">
          <div>
            <p className="eyebrow">Role editor</p>
            <h2>Edit role</h2>
            <p className="muted">Internal search details and the public posting live in one place.</p>
          </div>
          <nav className="role-editor-nav" aria-label="Role editor sections">
            <a href="#role-basics">Basics</a>
            <a href="#role-public">Public posting</a>
            <a href="#role-content">Description</a>
            <a href="#pipeline">Pipeline</a>
          </nav>
        </div>

        {savedSuccess && !publishedSuccess ? <div className="success-box">Changes saved.</div> : null}
        {publishedSuccess ? <div className="success-box">Role saved and published successfully.</div> : null}
        {publishError ? <div className="error-box">{publishError}</div> : null}

        <form action={saveRoleEditor} className="role-editor-form">
          <input type="hidden" name="job_id" value={job.id} />

          <section className="role-editor-section" id="role-basics">
            <div className="role-editor-section-heading">
              <div>
                <span>01</span>
                <div>
                  <h3>Role basics</h3>
                  <p>Internal information for your recruiting team.</p>
                </div>
              </div>
              <span className="editor-visibility-badge">Internal only</span>
            </div>

            <div className="role-editor-grid">
              <label className="role-editor-wide">Internal role title
                <input name="title" defaultValue={job.title || ""} required />
              </label>
              <label>Owner
                <select name="owner_id" defaultValue={job.owner_id || recruiter.id} required>
                  {(teamRecruiters || []).map((member) => (
                    <option value={member.id} key={member.id}>{member.name} · {member.role}</option>
                  ))}
                </select>
              </label>
              <label>Department
                <input name="department" defaultValue={job.department || ""} />
              </label>
              <label>Client
                <input name="client_name" defaultValue={job.client_name || ""} />
              </label>
              <label>Hiring manager
                <input name="hiring_manager" defaultValue={job.hiring_manager || ""} />
              </label>
              <label>Client contact
                <input name="client_contact" defaultValue={job.client_contact || ""} />
              </label>
              <label className="role-editor-wide">Interview stages
                <textarea name="interview_stages" rows="3" defaultValue={interviewStages.join("\n")} placeholder={"Recruiter Screen\nHiring Manager\nPanel\nFinal"} />
                <span className="field-help">One stage per line.</span>
              </label>
              <label className="role-editor-wide">Internal notes
                <textarea name="internal_notes" rows="3" defaultValue={job.internal_notes || ""} />
              </label>
            </div>
          </section>

          <section className="role-editor-section" id="role-public">
            <div className="role-editor-section-heading">
              <div>
                <span>02</span>
                <div>
                  <h3>Public posting</h3>
                  <p>The details candidates see before opening the full role.</p>
                </div>
              </div>
              <span className="editor-visibility-badge public">Candidate-facing</span>
            </div>

            <div className="role-editor-grid">
              <label className="role-editor-wide">Public title
                <input name="public_title" defaultValue={post.title || job.title || ""} required />
              </label>
              <label>Department
                <input name="public_department" defaultValue={post.department || job.department || ""} />
              </label>
              <label>Location <span className="required-label">Required</span>
                <input name="location" defaultValue={post.location || ""} placeholder="Austin, TX / Remote" required />
              </label>
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
              <label className="role-editor-wide">Compensation
                <input name="compensation" defaultValue={post.compensation || ""} placeholder="$180k–$220k base" />
              </label>
            </div>

            {!post.published && publishMissing.length ? (
              <div className="publish-readiness">
                <strong>Needed before publishing:</strong>
                <span>{publishMissing.join(" · ")}</span>
              </div>
            ) : null}
          </section>

          <section className="role-editor-section" id="role-content">
            <div className="role-editor-section-heading">
              <div>
                <span>03</span>
                <div>
                  <h3>Role description</h3>
                  <p>Write and edit the candidate-facing content without leaving the page.</p>
                </div>
              </div>
            </div>

            <div className="role-content-stack">
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
                rows={6}
                initialValue={post.description || ""}
              />
              <RichTextEditor
                name="responsibilities"
                label="What you'll do"
                rows={6}
                initialValue={post.responsibilities || ""}
              />
              <RichTextEditor
                name="requirements"
                label="What we're looking for"
                rows={6}
                initialValue={post.requirements || ""}
              />
            </div>
          </section>

          <div className="role-editor-actions">
            <div>
              <span className={post.published ? "status-pill published" : "status-pill"}>
                {post.published ? "Live" : "Draft"}
              </span>
              <span className="muted">{post.published ? "Saving keeps the live posting updated." : "Save anytime without publishing."}</span>
            </div>
            <div>
              <button type="submit" name="intent" value="save" className="secondary-button">Save changes</button>
              {!post.published ? (
                <button type="submit" name="intent" value="publish">Save & Publish</button>
              ) : null}
            </div>
          </div>
        </form>

        {post.published ? (
          <div className="role-editor-live-actions">
            <div>
              <strong>Live posting controls</strong>
              <p className="muted">These actions affect candidate visibility immediately.</p>
            </div>
            <div>
              {post.slug ? (
                <Link className="secondary-button" href={`/jobs/${post.slug}`} target="_blank">View live posting</Link>
              ) : null}
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
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <h2>Role follow-ups</h2>
            <p className="muted">Track client feedback and actions tied to this search.</p>
          </div>
        </div>

        <form action={createTask} className="task-create-form compact-task-form">
          <input type="hidden" name="job_id" value={job.id} />
          <label>Type
            <select name="task_type" defaultValue="follow_up_client">
              <option value="follow_up_client">Follow up client</option>
              <option value="check_feedback">Check feedback</option>
              <option value="send_submission">Send submission</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Task<input name="title" required placeholder="Check client feedback" /></label>
          <label>Priority
            <select name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>Due<input name="due_at" type="datetime-local" /></label>
          <button type="submit">Add task</button>
        </form>

        <div className="task-list compact-task-list">
          {(tasks || []).map((task) => (
            <article className="task-row" key={task.id}>
              <div className="task-main">
                <div className="task-title-line">
                  <strong>{task.title}</strong>
                  <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                </div>
                <span>{[task.candidate?.full_name, task.task_type.replaceAll("_", " "), task.due_at ? new Date(task.due_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }) : null].filter(Boolean).join(" · ")}</span>
              </div>
              <form action={updateTaskStatus}>
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="status" value={task.status === "done" ? "open" : "done"} />
                <button type="submit" className={task.status === "done" ? "secondary-button" : ""}>{task.status === "done" ? "Reopen" : "Done"}</button>
              </form>
            </article>
          ))}
          {!tasks?.length ? <p className="muted">No role follow-ups yet.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Offers & placements</p>
            <h2>Closing metrics</h2>
          </div>
        </div>

        <div className="feedback-metrics">
          <article><span>Offers</span><strong>{offerCount}</strong></article>
          <article><span>Accepted</span><strong>{acceptedOffers}</strong></article>
          <article><span>Placements</span><strong>{placements.length}</strong></article>
          <article><span>Est. fees</span><strong>{estimatedFees ? `${Math.round(estimatedFees).toLocaleString()}` : "$0"}</strong></article>
          <article><span>Final fees</span><strong>{finalFees ? `${Math.round(finalFees).toLocaleString()}` : "$0"}</strong></article>
        </div>

        <div className="table-list top-gap-small">
          {placements.map((app) => (
            <Link className="table-row placement-row" href={`/admin/candidates/${app.candidate.id}`} key={app.id}>
              <div>
                <strong>{app.candidate.full_name}</strong>
                <span>{[
                  app.placement.placed_compensation ? `Comp: ${app.placement.currency || "USD"} ${Number(app.placement.placed_compensation).toLocaleString()}` : null,
                  app.placement.start_date ? `Starts ${app.placement.start_date}` : null
                ].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="submission-row-meta">
                <span className={`invoice-pill ${app.placement.invoice_status}`}>{app.placement.invoice_status.replaceAll("_"," ")}</span>
                <span>{app.placement.final_fee ? `${Number(app.placement.final_fee).toLocaleString()}` : app.placement.estimated_fee ? `Est. ${Number(app.placement.estimated_fee).toLocaleString()}` : "Fee pending"}</span>
              </div>
            </Link>
          ))}
          {!placements.length ? <p className="muted">No placements recorded yet.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Submission analytics</p>
            <h2>Client response</h2>
          </div>
        </div>

        <div className="feedback-metrics">
          <article><span>Submitted</span><strong>{submittedApps.length}</strong></article>
          <article><span>Advanced</span><strong>{advancedCount}</strong></article>
          <article><span>On hold</span><strong>{holdCount}</strong></article>
          <article><span>Rejected</span><strong>{rejectedCount}</strong></article>
          <article>
            <span>Advance rate</span>
            <strong>{submittedApps.length ? Math.round((advancedCount / submittedApps.length) * 100) : 0}%</strong>
          </article>
        </div>

        <div className="top-reasons">
          <strong>Top feedback reasons</strong>
          {topReasons.length ? topReasons.map(([reason,count]) => (
            <div key={reason}><span>{reason}</span><strong>{count}</strong></div>
          )) : <p className="muted">No feedback reasons recorded yet.</p>}
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Client submissions</p>
            <h2>Submission status</h2>
          </div>
        </div>

        <div className="table-list">
          {(applications || [])
            .filter((app) => app.submission)
            .sort((a, b) => {
              const order = { submitted: 0, ready: 1, draft: 2 };
              return (order[a.submission.status] ?? 9) - (order[b.submission.status] ?? 9);
            })
            .map((app) => (
              <Link className="table-row submission-row" href={`/admin/candidates/${app.candidate.id}`} key={app.id}>
                <div>
                  <strong>{app.candidate.full_name}</strong>
                  <span>{[app.candidate.current_title, app.candidate.current_company].filter(Boolean).join(" · ")}</span>
                  <span>
                    {[app.submission.compensation, app.submission.availability, app.submission.relocation].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="submission-row-meta">
                  <span className={`submission-status ${app.submission.status}`}>{app.submission.status}</span>
                  {app.submission.submitted_at ? (
                    <span>{new Date(app.submission.submitted_at).toLocaleDateString("en-US", { timeZone: "America/Puerto_Rico" })}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          {!applications?.some((app) => app.submission) ? <p className="muted">No client submissions prepared yet.</p> : null}
        </div>
      </section>

      <section className="panel top-gap" id="pipeline">
        <div className="section-heading">
          <div>
            <h2>Pipeline</h2>
            <p className="muted">Drag candidates between stages. Changes save automatically.</p>
          </div>
        </div>
        <PipelineBoard applications={applications || []} interviewStages={interviewStages} />
      </section>
    </AdminShell>
  );
}
