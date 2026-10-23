import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../lib/auth";
import AdminShell from "../../admin-shell";
import { gmailComposeUrl, googleCalendarUrl, mailtoUrl } from "../../communication-links";
import { getGoogleConnection } from "../../../../lib/google";
import CopySubmissionButton from "../../copy-submission-button";
import {
  addCandidateNote,
  addClientFeedback,
  attachCandidateToJob,
  createInterview,
  createInterviewCalendarEvent,
  createTask,
  saveCandidateSubmission,
  saveOffer,
  savePlacement,
  sendCandidateEmail,
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


function buildSubmissionText(candidate, job, submission) {
  const lines = [
    candidate.full_name,
    [candidate.current_title, candidate.current_company].filter(Boolean).join(" · "),
    candidate.location ? `Location: ${candidate.location}` : null,
    "",
    submission?.recruiter_summary || null,
    submission?.key_strengths ? `Key strengths: ${submission.key_strengths}` : null,
    submission?.compensation ? `Compensation: ${submission.compensation}` : null,
    submission?.availability ? `Availability: ${submission.availability}` : null,
    submission?.notice_period ? `Notice period: ${submission.notice_period}` : null,
    submission?.work_authorization ? `Work authorization: ${submission.work_authorization}` : null,
    submission?.visa_sponsorship ? `Visa sponsorship: ${submission.visa_sponsorship}` : null,
    submission?.relocation ? `Relocation: ${submission.relocation}` : null,
    submission?.location_preference ? `Location preference: ${submission.location_preference}` : null,
    submission?.client_notes ? `Notes: ${submission.client_notes}` : null,
    "",
    `Role: ${job.title}`
  ].filter((line) => line !== null);

  return lines.join("\n");
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

  const [{ data: applications }, { data: notes }, { data: jobs }, { data: activities }, { data: tasks }, { data: communications }] = await Promise.all([
    supabase.from("applications")
      .select("id, stage, interview_stage, disposition, disposition_reason, disposition_at, job:jobs(id,title,interview_stages), interviews(id, stage_name, scheduled_at, status, notes, duration_minutes, meeting_url, google_event_id, google_calendar_link, created_at, updated_at), submission:candidate_submissions(id,status,recruiter_summary,key_strengths,compensation,availability,work_authorization,visa_sponsorship,relocation,location_preference,notice_period,client_notes,submitted_at,updated_at), client_feedback(id,feedback_type,feedback,reason,next_step,received_at), offers(id,status,base_salary,bonus,total_comp,currency,equity,sign_on_bonus,start_date,expiration_date,notes,extended_at,responded_at,created_at,updated_at), placement:placements(id,offer_id,start_date,placed_compensation,currency,fee_type,fee_percentage,estimated_fee,final_fee,invoice_status,invoice_date,payment_date,guarantee_end_date,notes,updated_at)")
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
      .order("due_at", { ascending:true, nullsFirst:false }),
    supabase.from("communications")
      .select("id,channel,direction,subject,recipient,status,occurred_at,provider_message_id,provider_event_id,metadata")
      .eq("candidate_id", id)
      .order("occurred_at", { ascending:false })
      .limit(30)
  ]);

  const googleConnection = await getGoogleConnection(supabase, recruiter.id);
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
        <div className="candidate-header-actions">
          {candidate.email ? (
            <a
              className="secondary-button"
              href={mailtoUrl({
                to: candidate.email,
                subject: "Checking in",
                body: `Hi ${candidate.full_name},\n\n`
              })}
            >
              Email candidate
            </a>
          ) : null}
          {resumeUrl ? <a className="primary-button" href={resumeUrl}>Open résumé</a> : null}
        </div>
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Communication</p>
            <h2>Email candidate</h2>
          </div>
          <Link className="secondary-button" href="/admin/integrations">
            {googleConnection ? "Google connected" : "Connect Google"}
          </Link>
        </div>

        {googleConnection && candidate.email ? (
          <form action={sendCandidateEmail} className="stack-form">
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <label>Subject
              <input name="subject" required placeholder="Checking in" />
            </label>
            <label>Message
              <textarea
                name="body"
                rows="6"
                required
                defaultValue={`Hi ${candidate.full_name},\n\n`}
              />
            </label>
            <button type="submit">Send email</button>
          </form>
        ) : (
          <p className="muted">
            {!candidate.email
              ? "Add an email address to this candidate before sending."
              : "Connect Google Workspace to send directly from JVRecruit."}
          </p>
        )}
      </section>

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

              <div className="submission-section">
                <div className="section-heading compact-heading">
                  <div>
                    <strong>Client submission</strong>
                    <p className="muted">Prepare the candidate snapshot for this specific role.</p>
                  </div>
                  {app.submission ? (
                    <span className={`submission-status ${app.submission.status}`}>{app.submission.status}</span>
                  ) : null}
                </div>

                <form action={saveCandidateSubmission} className="submission-form">
                  <input type="hidden" name="application_id" value={app.id} />

                  <label className="full-span">Recruiter summary
                    <textarea
                      name="recruiter_summary"
                      rows="4"
                      defaultValue={app.submission?.recruiter_summary || ""}
                      placeholder="Why this candidate is a strong fit for this role..."
                    />
                  </label>

                  <label className="full-span">Key strengths
                    <textarea
                      name="key_strengths"
                      rows="3"
                      defaultValue={app.submission?.key_strengths || ""}
                      placeholder="Technical depth, domain fit, leadership, 0→1, scale..."
                    />
                  </label>

                  <label>Compensation
                    <input name="compensation" defaultValue={app.submission?.compensation || ""} placeholder="$180k base / $230k TC" />
                  </label>
                  <label>Availability
                    <input name="availability" defaultValue={app.submission?.availability || ""} placeholder="Available next week / specific windows" />
                  </label>
                  <label>Notice period
                    <input name="notice_period" defaultValue={app.submission?.notice_period || ""} placeholder="2 weeks" />
                  </label>
                  <label>Work authorization
                    <input name="work_authorization" defaultValue={app.submission?.work_authorization || ""} placeholder="US Citizen / GC / H-1B" />
                  </label>
                  <label>Visa sponsorship
                    <input name="visa_sponsorship" defaultValue={app.submission?.visa_sponsorship || ""} placeholder="Not needed / Needs transfer" />
                  </label>
                  <label>Relocation
                    <input name="relocation" defaultValue={app.submission?.relocation || ""} placeholder="Open / Not open / Austin only" />
                  </label>
                  <label>Location preference
                    <input name="location_preference" defaultValue={app.submission?.location_preference || ""} placeholder="Remote / Austin / Bay Area" />
                  </label>
                  <label className="full-span">Client notes
                    <textarea
                      name="client_notes"
                      rows="3"
                      defaultValue={app.submission?.client_notes || ""}
                      placeholder="Anything the client should know before the first conversation..."
                    />
                  </label>

                  <div className="submission-actions full-span">
                    <button type="submit" name="intent" value="draft" className="secondary-button">Save draft</button>
                    <button type="submit" name="intent" value="ready">Mark ready</button>
                    <button type="submit" name="intent" value="submitted">Mark submitted</button>
                    <CopySubmissionButton text={buildSubmissionText(candidate, app.job, app.submission || {})} />
                    {app.submission?.submitted_at ? (
                      <span className="muted">
                        Submitted {new Date(app.submission.submitted_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" })}
                      </span>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="feedback-section">
                <div className="section-heading compact-heading">
                  <div>
                    <strong>Client feedback</strong>
                    <p className="muted">Track advance, hold or rejection feedback for this process.</p>
                  </div>
                  {app.disposition ? <span className={`disposition-pill ${app.disposition}`}>{app.disposition}</span> : null}
                </div>

                <form action={addClientFeedback} className="feedback-form">
                  <input type="hidden" name="application_id" value={app.id} />
                  <label>Outcome
                    <select name="feedback_type" defaultValue="general">
                      <option value="general">General feedback</option>
                      <option value="advance">Advance</option>
                      <option value="hold">Hold</option>
                      <option value="reject">Reject</option>
                    </select>
                  </label>
                  <label>Reason
                    <input name="reason" placeholder="Technical fit, comp, experience, timing..." />
                  </label>
                  <label>Next step
                    <input name="next_step" placeholder="HM interview, panel, wait for feedback..." />
                  </label>
                  <label className="full-span">Feedback
                    <textarea name="feedback" rows="3" placeholder="Client comments..." />
                  </label>
                  <button type="submit">Add feedback</button>
                </form>

                <div className="feedback-list">
                  {(app.client_feedback || [])
                    .sort((a,b) => new Date(b.received_at) - new Date(a.received_at))
                    .map((item) => (
                      <article className="feedback-card" key={item.id}>
                        <div>
                          <span className={`feedback-type ${item.feedback_type}`}>{item.feedback_type}</span>
                          <strong>{item.reason || item.next_step || "Client feedback"}</strong>
                        </div>
                        {item.feedback ? <p>{item.feedback}</p> : null}
                        {item.next_step ? <span>Next: {item.next_step}</span> : null}
                        <time>{new Date(item.received_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" })}</time>
                      </article>
                    ))}
                  {!app.client_feedback?.length ? <p className="muted">No client feedback yet.</p> : null}
                </div>
              </div>

              <div className="offer-section">
                <div className="section-heading compact-heading">
                  <div>
                    <strong>Offer & placement</strong>
                    <p className="muted">Track offer terms, acceptance, start date and placement fee.</p>
                  </div>
                  {app.placement ? <span className="placement-pill">Placed</span> : null}
                </div>

                <div className="offer-history">
                  {(app.offers || [])
                    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((offer) => (
                      <form action={saveOffer} className="offer-card" key={offer.id}>
                        <input type="hidden" name="application_id" value={app.id} />
                        <input type="hidden" name="offer_id" value={offer.id} />
                        <div className="offer-card-header">
                          <strong>{offer.status === "draft" ? "Offer draft" : `Offer · ${offer.status}`}</strong>
                          <span className={`offer-status ${offer.status}`}>{offer.status}</span>
                        </div>

                        <div className="offer-grid">
                          <label>Base salary<input name="base_salary" type="number" step="0.01" defaultValue={offer.base_salary ?? ""} /></label>
                          <label>Bonus<input name="bonus" type="number" step="0.01" defaultValue={offer.bonus ?? ""} /></label>
                          <label>Total comp<input name="total_comp" type="number" step="0.01" defaultValue={offer.total_comp ?? ""} /></label>
                          <label>Sign-on<input name="sign_on_bonus" type="number" step="0.01" defaultValue={offer.sign_on_bonus ?? ""} /></label>
                          <label>Currency<input name="currency" defaultValue={offer.currency || "USD"} /></label>
                          <label>Start date<input name="start_date" type="date" defaultValue={offer.start_date || ""} /></label>
                          <label>Expiration<input name="expiration_date" type="date" defaultValue={offer.expiration_date || ""} /></label>
                          <label>Status
                            <select name="status" defaultValue={offer.status}>
                              <option value="draft">Draft</option>
                              <option value="extended">Extended</option>
                              <option value="accepted">Accepted</option>
                              <option value="declined">Declined</option>
                              <option value="withdrawn">Withdrawn</option>
                            </select>
                          </label>
                          <label className="full-span">Equity<input name="equity" defaultValue={offer.equity || ""} placeholder="Equity / options / RSUs" /></label>
                          <label className="full-span">Notes<textarea name="notes" rows="2" defaultValue={offer.notes || ""} /></label>
                        </div>
                        <button type="submit">Save offer</button>
                      </form>
                    ))}

                  <form action={saveOffer} className="offer-card new-offer-card">
                    <input type="hidden" name="application_id" value={app.id} />
                    <div className="offer-card-header">
                      <strong>New offer</strong>
                    </div>
                    <div className="offer-grid">
                      <label>Base salary<input name="base_salary" type="number" step="0.01" /></label>
                      <label>Bonus<input name="bonus" type="number" step="0.01" /></label>
                      <label>Total comp<input name="total_comp" type="number" step="0.01" /></label>
                      <label>Sign-on<input name="sign_on_bonus" type="number" step="0.01" /></label>
                      <label>Currency<input name="currency" defaultValue="USD" /></label>
                      <label>Start date<input name="start_date" type="date" /></label>
                      <label>Expiration<input name="expiration_date" type="date" /></label>
                      <label>Status
                        <select name="status" defaultValue="draft">
                          <option value="draft">Draft</option>
                          <option value="extended">Extended</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </label>
                      <label className="full-span">Equity<input name="equity" placeholder="Equity / options / RSUs" /></label>
                      <label className="full-span">Notes<textarea name="notes" rows="2" /></label>
                    </div>
                    <button type="submit">Create offer</button>
                  </form>
                </div>

                {app.placement ? (
                  <form action={savePlacement} className="placement-form">
                    <input type="hidden" name="application_id" value={app.id} />
                    <div className="section-heading compact-heading">
                      <div>
                        <strong>Placement record</strong>
                        <p className="muted">Fee, invoice and start-date tracking.</p>
                      </div>
                    </div>
                    <div className="placement-grid">
                      <label>Start date<input name="start_date" type="date" defaultValue={app.placement.start_date || ""} /></label>
                      <label>Placed compensation<input name="placed_compensation" type="number" step="0.01" defaultValue={app.placement.placed_compensation ?? ""} /></label>
                      <label>Currency<input name="currency" defaultValue={app.placement.currency || "USD"} /></label>
                      <label>Fee type
                        <select name="fee_type" defaultValue={app.placement.fee_type || ""}>
                          <option value="">Select</option>
                          <option value="percentage">Percentage</option>
                          <option value="flat">Flat fee</option>
                        </select>
                      </label>
                      <label>Fee %<input name="fee_percentage" type="number" step="0.01" defaultValue={app.placement.fee_percentage ?? ""} /></label>
                      <label>Estimated fee<input name="estimated_fee" type="number" step="0.01" defaultValue={app.placement.estimated_fee ?? ""} /></label>
                      <label>Final fee<input name="final_fee" type="number" step="0.01" defaultValue={app.placement.final_fee ?? ""} /></label>
                      <label>Invoice status
                        <select name="invoice_status" defaultValue={app.placement.invoice_status || "not_invoiced"}>
                          <option value="not_invoiced">Not invoiced</option>
                          <option value="invoiced">Invoiced</option>
                          <option value="paid">Paid</option>
                          <option value="adjusted">Adjusted</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                      <label>Invoice date<input name="invoice_date" type="date" defaultValue={app.placement.invoice_date || ""} /></label>
                      <label>Payment date<input name="payment_date" type="date" defaultValue={app.placement.payment_date || ""} /></label>
                      <label>Guarantee end<input name="guarantee_end_date" type="date" defaultValue={app.placement.guarantee_end_date || ""} /></label>
                      <label className="full-span">Notes<textarea name="notes" rows="2" defaultValue={app.placement.notes || ""} /></label>
                    </div>
                    <button type="submit">Save placement</button>
                  </form>
                ) : null}
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
                  <label>Duration
                    <select name="duration_minutes" defaultValue="30">
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                    </select>
                  </label>
                  <label>Meeting link
                    <input name="meeting_url" type="url" placeholder="Google Meet / Zoom / Teams" />
                  </label>
                  <label className="interview-notes-field">Notes
                    <input name="notes" placeholder="Optional scheduling note" />
                  </label>
                  <button type="submit">Schedule interview</button>
                </form>

                <div className="interview-list">
                  {(app.interviews || [])
                    .sort((a, b) => new Date(b.scheduled_at || b.created_at) - new Date(a.scheduled_at || a.created_at))
                    .map((interview) => {
                      const calendarUrl = googleCalendarUrl({
                        title: `${interview.stage_name}: ${candidate.full_name} — ${app.job.title}`,
                        start: interview.scheduled_at,
                        durationMinutes: interview.duration_minutes || 30,
                        details: [
                          `Candidate: ${candidate.full_name}`,
                          `Role: ${app.job.title}`,
                          interview.notes || null,
                          interview.meeting_url ? `Meeting: ${interview.meeting_url}` : null
                        ].filter(Boolean).join("\n\n"),
                        location: interview.meeting_url || undefined,
                        guestEmail: candidate.email || undefined
                      });

                      const emailUrl = candidate.email ? gmailComposeUrl({
                        to: candidate.email,
                        subject: `${interview.stage_name} — ${app.job.title}`,
                        body: [
                          `Hi ${candidate.full_name},`,
                          "",
                          `Confirming your ${interview.stage_name} for the ${app.job.title} opportunity.`,
                          interview.scheduled_at ? `Date/time: ${displayPuertoRicoDate(interview.scheduled_at)} (Puerto Rico / Atlantic Time)` : null,
                          interview.duration_minutes ? `Duration: ${interview.duration_minutes} minutes` : null,
                          interview.meeting_url ? `Meeting link: ${interview.meeting_url}` : null,
                          "",
                          "Best,",
                          recruiter.name
                        ].filter((line) => line !== null).join("\n")
                      }) : null;

                      return (
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
                            <label>Duration
                              <select name="duration_minutes" defaultValue={String(interview.duration_minutes || 30)}>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="90">90 min</option>
                              </select>
                            </label>
                            <label>Status
                              <select name="status" defaultValue={interview.status}>
                                {INTERVIEW_STATUSES.map((status) => <option value={status} key={status}>{status.replace("_", " ")}</option>)}
                              </select>
                            </label>
                          </div>

                          <label>Meeting link
                            <input name="meeting_url" type="url" defaultValue={interview.meeting_url || ""} placeholder="Google Meet / Zoom / Teams" />
                          </label>

                          <label>Interview notes
                            <textarea name="notes" rows="3" defaultValue={interview.notes || ""} placeholder="Feedback, outcome, follow-up..." />
                          </label>

                          <div className="interview-actions">
                            <button type="submit">Save interview</button>
                            {googleConnection ? (
                              interview.google_event_id ? (
                                interview.google_calendar_link ? <a href={interview.google_calendar_link} target="_blank" rel="noreferrer">Open Calendar event</a> : null
                              ) : (
                                <button type="submit" formAction={createInterviewCalendarEvent}>Create Google Calendar event</button>
                              )
                            ) : calendarUrl ? <a href={calendarUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a> : null}
                            {googleConnection ? null : emailUrl ? <a href={emailUrl} target="_blank" rel="noreferrer">Draft in Gmail</a> : null}
                            {interview.meeting_url ? <a href={interview.meeting_url} target="_blank" rel="noreferrer">Open meeting</a> : null}
                          </div>
                        </form>
                      );
                    })}
                  {!app.interviews?.length ? <p className="muted">No interviews scheduled yet.</p> : null}
                </div>
              </div>
            </div>
          ))}
          {!applications?.length ? <p className="muted">Not currently attached to a role.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Communication history</h2>
          </div>
        </div>
        <div className="communication-list">
          {(communications || []).map((item) => (
            <article className="communication-row" key={item.id}>
              <div>
                <strong>{item.channel === "email" ? "Email sent" : "Calendar event created"}</strong>
                <span>{item.subject || item.recipient || "Google Workspace activity"}</span>
              </div>
              <span>{new Date(item.occurred_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" })}</span>
            </article>
          ))}
          {!communications?.length ? <p className="muted">No Google communications recorded yet.</p> : null}
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
