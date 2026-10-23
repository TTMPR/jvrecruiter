import Link from "next/link";
import { notFound } from "next/navigation";
import { createPortalClient } from "../../../lib/supabase/portal";
import {
  updatePortalProfile,
  uploadPortalResume,
  withdrawPortalApplication
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application status | JVRecruit",
  robots: { index: false, follow: false }
};

function friendlyStage(stage) {
  if (stage === "Withdrawn") return { label: "Withdrawn", step: 0 };
  if (stage === "Rejected" || stage === "Archived") return { label: "Application closed", step: 4 };
  if (stage === "Placed") return { label: "Completed", step: 4 };
  if (stage === "Offer") return { label: "Decision", step: 4 };
  if (stage === "Interviewing") return { label: "Interviewing", step: 3 };
  if (["Submitted","Client Sub"].includes(stage)) return { label: "Under review", step: 2 };
  return { label: "Application received", step: 1 };
}

const STEPS = [
  ["Application received", "Your application is in the system."],
  ["Recruiter review", "Your background is being reviewed for the search."],
  ["Interviewing", "Interview steps appear here when scheduled."],
  ["Decision", "The recruiting team will contact you directly about the outcome."]
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Puerto_Rico",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function CandidatePortalPage({ params }) {
  const { token } = await params;
  const supabase = createPortalClient(token);

  const { data: application, error } = await supabase
    .from("applications")
    .select(`
      id,stage,interview_stage,resume_document_id,updated_at,
      candidate:candidates(id,full_name,email,phone,linkedin_url,location,current_title,current_company,latest_resume_name,updated_at),
      job:jobs(id,title,status,department),
      interviews(id,stage_name,scheduled_at,status,duration_minutes,meeting_url,updated_at),
      resume:candidate_documents(id,file_name,label,created_at),
      updates:candidate_portal_updates(id,update_type,title,body,created_at)
    `)
    .limit(1)
    .maybeSingle();

  if (error || !application?.candidate || !application?.job) notFound();

  const status = friendlyStage(application.stage);
  const interviews = (application.interviews || [])
    .filter((interview) => interview.status === "scheduled")
    .sort((a,b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

  const withdrawn = application.stage === "Withdrawn";

  return (
    <main className="portal-shell">
      <header className="portal-nav">
        <Link href="/"><strong>JVRecruit</strong></Link>
        <Link href="/">Open roles</Link>
      </header>

      <section className="portal-hero">
        <p className="eyebrow">Candidate portal</p>
        <h1>{application.job.title}</h1>
        <p>
          Hi {application.candidate.full_name.split(" ")[0]}. Here’s the latest status of your application and anything you may need to update.
        </p>
        <span className={`portal-status ${withdrawn ? "withdrawn" : ""}`}>{status.label}</span>
      </section>

      {!withdrawn ? (
        <>
          <section className="portal-card">
            <div className="portal-section-heading">
              <div>
                <p className="eyebrow">Application status</p>
                <h2>Where things stand</h2>
              </div>
              <span>Last updated {new Date(application.updated_at).toLocaleDateString("en-US", { timeZone:"America/Puerto_Rico" })}</span>
            </div>

            <div className="portal-timeline">
              {STEPS.map(([label,description], index) => {
                const stepNumber = index + 1;
                const complete = stepNumber <= status.step;
                const current = stepNumber === status.step;
                return (
                  <article className={`portal-step ${complete ? "complete" : ""} ${current ? "current" : ""}`} key={label}>
                    <span>{stepNumber}</span>
                    <div>
                      <strong>{label}</strong>
                      <p>{description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="portal-card">
            <div className="portal-section-heading">
              <div>
                <p className="eyebrow">Updates</p>
                <h2>From your recruiter</h2>
              </div>
            </div>

            <div className="portal-update-feed">
              {(application.updates || [])
                .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
                .map((update) => (
                  <article key={update.id}>
                    <span>{update.update_type.replaceAll("_"," ")}</span>
                    <div>
                      <strong>{update.title}</strong>
                      {update.body ? <p>{update.body}</p> : null}
                      <time>{formatDate(update.created_at)}</time>
                    </div>
                  </article>
                ))}
              {!application.updates?.length ? (
                <p className="muted">No new recruiter updates yet. Your current application status is shown above.</p>
              ) : null}
            </div>
          </section>

          <section className="portal-card">
            <div className="portal-section-heading">
              <div>
                <p className="eyebrow">Interviews</p>
                <h2>Upcoming schedule</h2>
              </div>
            </div>

            <div className="portal-interviews">
              {interviews.map((interview) => (
                <article key={interview.id}>
                  <div>
                    <strong>{interview.stage_name}</strong>
                    <span>{interview.scheduled_at ? formatDate(interview.scheduled_at) : "Scheduling in progress"}</span>
                    {interview.duration_minutes ? <span>{interview.duration_minutes} minutes</span> : null}
                  </div>
                  {interview.meeting_url ? (
                    <a href={interview.meeting_url} target="_blank" rel="noreferrer">Open meeting</a>
                  ) : null}
                </article>
              ))}
              {!interviews.length ? <p className="muted">No interviews are currently scheduled.</p> : null}
            </div>
          </section>

          <section className="portal-grid">
            <section className="portal-card">
              <div className="portal-section-heading">
                <div>
                  <p className="eyebrow">Your profile</p>
                  <h2>Keep details current</h2>
                </div>
              </div>

              <form action={updatePortalProfile} className="portal-form">
                <input type="hidden" name="portal_token" value={token} />
                <label>Email<input name="email" type="email" defaultValue={application.candidate.email || ""} /></label>
                <label>Phone<input name="phone" type="tel" defaultValue={application.candidate.phone || ""} /></label>
                <label>Location<input name="location" defaultValue={application.candidate.location || ""} /></label>
                <label>Current title<input name="current_title" defaultValue={application.candidate.current_title || ""} /></label>
                <label>Current company<input name="current_company" defaultValue={application.candidate.current_company || ""} /></label>
                <label>LinkedIn<input name="linkedin_url" type="url" defaultValue={application.candidate.linkedin_url || ""} /></label>
                <button type="submit">Save updates</button>
              </form>
            </section>

            <section className="portal-card">
              <div className="portal-section-heading">
                <div>
                  <p className="eyebrow">Résumé</p>
                  <h2>Update your résumé</h2>
                </div>
              </div>

              <div className="portal-current-resume">
                <span>Current for this application</span>
                <strong>{application.resume?.file_name || application.candidate.latest_resume_name || "No résumé selected"}</strong>
              </div>

              <form action={uploadPortalResume} className="portal-form">
                <input type="hidden" name="portal_token" value={token} />
                <label>
                  New résumé
                  <input name="resume" type="file" accept=".pdf,.doc,.docx" required />
                </label>
                <p className="form-hint">PDF, DOC or DOCX · maximum 10 MB.</p>
                <button type="submit">Upload résumé</button>
              </form>
            </section>
          </section>

          <section className="portal-card portal-withdraw-card">
            <div>
              <p className="eyebrow">Application controls</p>
              <h2>Need to step away from this search?</h2>
              <p>You can withdraw your application here. This will stop the active process for this role.</p>
            </div>
            <form action={withdrawPortalApplication}>
              <input type="hidden" name="portal_token" value={token} />
              <button type="submit" className="danger-button">Withdraw application</button>
            </form>
          </section>
        </>
      ) : (
        <section className="portal-card portal-closed-state">
          <span>✓</span>
          <div>
            <h2>Your application has been withdrawn.</h2>
            <p>No further action is required for this role. You can still explore other opportunities on JVRecruit.</p>
            <Link className="secondary-button" href="/">View open roles</Link>
          </div>
        </section>
      )}

      <footer className="portal-footer">
        <span>Your portal link is private. Do not forward it to others.</span>
        <Link href="/">JVRecruit</Link>
      </footer>
    </main>
  );
}
