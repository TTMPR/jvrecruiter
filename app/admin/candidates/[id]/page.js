import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import {
  addCandidateNote,
  attachCandidateToJob,
  createInterview,
  createTask,
  updateApplicationStage,
  updateCandidate,
  updateInterview,
  updateTaskStatus
} from "../../actions";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];
const INTERVIEW_STATUSES = ["scheduled","completed","cancelled","no_show"];

function toPuertoRicoInput(value) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function displayPuertoRicoDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Puerto_Rico",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function CandidateDetailPage({ params }) {
  const { id } = await params;
  const { recruiter, supabase } = await requireRecruiter();

  const { data: candidate } = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
  if (!candidate) notFound();

  const [{ data: applications }, { data: notes }, { data: jobs }, { data: activities }, { data: tasks }] = await Promise.all([
    supabase.from("applications")
      .select("id, stage, interview_stage, job:jobs(id,title,interview_stages), interviews(id, stage_name, scheduled_at, status, notes, created_at, updated_at)")
      .eq("candidate_id", id)
      .order("updated_at", { ascending:false }),
    supabase.from("candidate_notes")
      .select("id, body, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending:false }),
    supabase.from("jobs")
      .select("id,title,status")
      .in("status", ["draft","published","paused"])
      .order("updated_at", { ascending:false }),
    supabase.from("activities")
      .select("id, activity_type, details, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending:false })
      .limit(20),
    supabase.from("tasks")
      .select("id,title,task_type,priority,status,due_at,job:jobs(id,title)")
      .eq("candidate_id", id)
      .order("status", { ascending:true })
      .order("due_at", { ascending:true, nullsFirst:false })
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
          <p className="eyebrow">Candidate master</p>
          <h2>Edit profile</h2>
          <form action={updateCandidate} className="stack-form">
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <div className="form-grid">
              <label>Full name<input name="full_name" defaultValue={candidate.full_name || ""} required /></label>
              <label>Email<input name="email" type="email" defaultValue={candidate.email || ""} /></label>
              <label>Phone<input name="phone" defaultValue={candidate.phone || ""} /></label>
              <label>Location<input name="location" defaultValue={candidate.location || ""} /></label>
              <label>Current title<input name="current_title" defaultValue={candidate.current_title || ""} /></label>
              <label>Current company<input name="current_company" defaultValue={candidate.current_company || ""} /></label>
              <label>LinkedIn<input name="linkedin_url" type="url" defaultValue={candidate.linkedin_url || ""} /></label>
              <label>Source<input name="source" defaultValue={candidate.source || ""} /></label>
            </div>
            <button type="submit">Save candidate</button>
          </form>
          <p className="muted profile-meta">
            Résumé: {candidate.latest_resume_name || "None"} · Last updated {new Date(candidate.updated_at).toLocaleDateString()}
          </p>
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
        <div className="section-heading">
          <div>
            <h2>Follow-ups</h2>
            <p className="muted">Create and complete recruiter tasks for this candidate.</p>
          </div>
        </div>

        <form action={createTask} className="task-create-form compact-task-form">
          <input type="hidden" name="candidate_id" value={candidate.id} />
          <label>Type
            <select name="task_type" defaultValue="follow_up_candidate">
              <option value="follow_up_candidate">Follow up candidate</option>
              <option value="schedule_interview">Schedule interview</option>
              <option value="send_submission">Send submission</option>
              <option value="check_feedback">Check feedback</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Task<input name="title" required placeholder="Follow up with candidate" /></label>
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
                <span>{[task.job?.title, task.task_type.replaceAll("_", " "), task.due_at ? new Date(task.due_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }) : null].filter(Boolean).join(" · ")}</span>
              </div>
              <form action={updateTaskStatus}>
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="status" value={task.status === "done" ? "open" : "done"} />
                <button type="submit" className={task.status === "done" ? "secondary-button" : ""}>{task.status === "done" ? "Reopen" : "Done"}</button>
              </form>
            </article>
          ))}
          {!tasks?.length ? <p className="muted">No follow-ups yet.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <h2>Processes</h2>
        <div className="table-list">
          {(applications || []).map((app) => (
            <div className="process-block" key={app.id}>
              <div className="table-row">
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

              <div className="interview-section">
                <div className="section-heading compact-heading">
                  <div>
                    <strong>Interviews</strong>
                    <p className="muted">Schedule and track each interview step for this process.</p>
                  </div>
                </div>

                <form action={createInterview} className="interview-form">
                  <input type="hidden" name="application_id" value={app.id} />
                  <label>Step
                    <select name="stage_name" defaultValue={app.interview_stage || ""} required>
                      <option value="">Select step</option>
                      {((app.job.interview_stages || []).length ? app.job.interview_stages : ["Recruiter Screen","Hiring Manager","Panel","Final"]).map((step) => (
                        <option key={step}>{step}</option>
                      ))}
                    </select>
                  </label>
                  <label>Date & time
                    <input name="scheduled_at" type="datetime-local" />
                  </label>
                  <label className="interview-notes-field">Notes
                    <input name="notes" placeholder="Optional scheduling note" />
                  </label>
                  <button type="submit">Schedule interview</button>
                </form>

                <div className="interview-list">
                  {(app.interviews || [])
                    .sort((a, b) => new Date(b.scheduled_at || b.created_at) - new Date(a.scheduled_at || a.created_at))
                    .map((interview) => (
                      <form action={updateInterview} className="interview-card" key={interview.id}>
                        <input type="hidden" name="interview_id" value={interview.id} />
                        <div className="interview-card-header">
                          <div>
                            <strong>{interview.stage_name}</strong>
                            <span>{displayPuertoRicoDate(interview.scheduled_at)}</span>
                          </div>
                          <span className={`interview-status ${interview.status}`}>{interview.status.replace("_", " ")}</span>
                        </div>

                        <div className="interview-edit-grid">
                          <label>Step<input name="stage_name" defaultValue={interview.stage_name} required /></label>
                          <label>Date & time<input name="scheduled_at" type="datetime-local" defaultValue={toPuertoRicoInput(interview.scheduled_at)} /></label>
                          <label>Status
                            <select name="status" defaultValue={interview.status}>
                              {INTERVIEW_STATUSES.map((status) => <option value={status} key={status}>{status.replace("_", " ")}</option>)}
                            </select>
                          </label>
                        </div>

                        <label>Interview notes
                          <textarea name="notes" rows="3" defaultValue={interview.notes || ""} placeholder="Feedback, outcome, follow-up..." />
                        </label>
                        <button type="submit">Save interview</button>
                      </form>
                    ))}
                  {!app.interviews?.length ? <p className="muted">No interviews scheduled yet.</p> : null}
                </div>
              </div>
            </div>
          ))}
          {!applications?.length ? <p className="muted">Not currently attached to a role.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <h2>Recent activity</h2>
        <div className="activity-list">
          {(activities || []).map((activity) => (
            <div className="activity-row" key={activity.id}>
              <strong>{activity.activity_type.replaceAll("_", " ")}</strong>
              <span>{new Date(activity.created_at).toLocaleString()}</span>
            </div>
          ))}
          {!activities?.length ? <p className="muted">No activity yet.</p> : null}
        </div>
      </section>
    </AdminShell>
  );
}
