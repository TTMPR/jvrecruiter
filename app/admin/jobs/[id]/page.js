import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import RichTextEditor from "../../rich-text-editor";
import PipelineBoard from "../../pipeline-board";
import {
  createTask,
  setPublicPostingState,
  updateJob,
  updatePublicPosting,
  updateTaskStatus
} from "../../actions";

const MAIN_STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed"];

export default async function JobDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: job }, { data: applications }, { data: tasks }] = await Promise.all([
    supabase.from("jobs").select("*, job_posts(*)").eq("id", id).maybeSingle(),
    supabase.from("applications")
      .select("id, stage, interview_stage, applied_at, candidate:candidates(id, full_name, current_title, current_company, location)")
      .eq("job_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("tasks")
      .select("id,title,task_type,priority,status,due_at,candidate:candidates(id,full_name)")
      .eq("job_id", id)
      .order("status", { ascending:true })
      .order("due_at", { ascending:true, nullsFirst:false })
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
            <h2>Pipeline</h2>
            <p className="muted">Drag candidates between stages. Changes save automatically.</p>
          </div>
        </div>
        <PipelineBoard applications={applications || []} interviewStages={interviewStages} />
      </section>
    </AdminShell>
  );
}
