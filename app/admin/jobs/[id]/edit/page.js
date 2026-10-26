import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "../../../../../lib/auth";
import AdminShell from "../../../admin-shell";
import RichTextEditor from "../../../rich-text-editor";
import { saveRoleEditor, setPublicPostingState } from "../../../actions";

export default async function EditJobPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: job }, { data: post }, { data: teamRecruiters }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    supabase.from("job_posts").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("recruiters")
      .select("id,name,email,role")
      .eq("organization_id", recruiter.organization_id)
      .eq("active", true)
      .order("name")
  ]);

  if (!job) notFound();

  const publicPost = post || {};
  const interviewStages = Array.isArray(job.interview_stages) ? job.interview_stages : [];
  const publishError = query?.publish_error;
  const publishedSuccess = query?.published === "1";
  const savedSuccess = query?.saved === "1";
  const publishMissing = [
    !publicPost.title ? "Public title" : null,
    !publicPost.location ? "Location" : null,
    !publicPost.short_summary ? "Short summary" : null,
    !publicPost.description ? "About the role" : null
  ].filter(Boolean);

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <Link className="back-link" href={`/admin/jobs/${job.id}`}>← Back to pipeline</Link>
          <p className="eyebrow">Edit JD</p>
          <h1>{job.title}</h1>
          <p className="muted">{job.client_name || "Confidential client"}</p>
        </div>
        <div className="publish-state">
          <span className={publicPost.published ? "status-pill published" : "status-pill"}>
            {publicPost.published ? "Live" : "Draft"}
          </span>
          {publicPost.published && publicPost.slug ? (
            <Link className="secondary-button" href={`/jobs/${publicPost.slug}`} target="_blank">
              View posting
            </Link>
          ) : null}
        </div>
      </header>

      <section className="role-editor-shell" id="role-editor">
        <div className="role-editor-topbar">
          <div>
            <p className="eyebrow">Job description</p>
            <h2>Edit role</h2>
            <p className="muted">Everything opens prefilled with the latest saved version.</p>
          </div>
          <nav className="role-editor-nav" aria-label="Role editor sections">
            <a href="#role-basics">Basics</a>
            <a href="#role-public">Posting</a>
            <a href="#role-content">Description</a>
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
                  <h3>Search basics</h3>
                  <p>Internal recruiting details.</p>
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
                  <p>The details candidates see.</p>
                </div>
              </div>
              <span className="editor-visibility-badge public">Candidate-facing</span>
            </div>

            <div className="role-editor-grid">
              <label className="role-editor-wide">Public title
                <input name="public_title" defaultValue={publicPost.title || job.title || ""} required />
              </label>
              <label>Department
                <input name="public_department" defaultValue={publicPost.department || job.department || ""} />
              </label>
              <label>Location <span className="required-label">Required</span>
                <input name="location" defaultValue={publicPost.location || ""} placeholder="Austin, TX / Remote" required />
              </label>
              <label>Workplace
                <select name="workplace" defaultValue={publicPost.workplace || ""}>
                  <option value="">Select</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </label>
              <label>Employment type
                <select name="employment_type" defaultValue={publicPost.employment_type || ""}>
                  <option value="">Select</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </label>
              <label className="role-editor-wide">Compensation
                <input name="compensation" defaultValue={publicPost.compensation || ""} placeholder="$180k–$220k base" />
              </label>
            </div>

            {!publicPost.published && publishMissing.length ? (
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
                  <h3>Job description</h3>
                  <p>Edit the candidate-facing content.</p>
                </div>
              </div>
            </div>

            <div className="role-content-stack">
              <RichTextEditor
                name="short_summary"
                label="Short summary"
                rows={3}
                initialValue={publicPost.short_summary || ""}
                placeholder="A concise overview shown on the Open Roles page."
              />
              <RichTextEditor
                name="description"
                label="About the role"
                rows={6}
                initialValue={publicPost.description || ""}
              />
              <RichTextEditor
                name="responsibilities"
                label="What you'll do"
                rows={6}
                initialValue={publicPost.responsibilities || ""}
              />
              <RichTextEditor
                name="requirements"
                label="What we're looking for"
                rows={6}
                initialValue={publicPost.requirements || ""}
              />
            </div>
          </section>

          <div className="role-editor-actions">
            <div>
              <span className={publicPost.published ? "status-pill published" : "status-pill"}>
                {publicPost.published ? "Live" : "Draft"}
              </span>
              <span className="muted">{publicPost.published ? "Saving updates the live posting." : "Save without publishing anytime."}</span>
            </div>
            <div>
              <Link className="secondary-button" href={`/admin/jobs/${job.id}`}>Cancel</Link>
              <button type="submit" name="intent" value="save" className="secondary-button">Save changes</button>
              {!publicPost.published ? (
                <button type="submit" name="intent" value="publish">Save & Publish</button>
              ) : null}
            </div>
          </div>
        </form>

        {publicPost.published ? (
          <div className="role-editor-live-actions">
            <div>
              <strong>Live posting controls</strong>
              <p className="muted">These actions affect candidate visibility immediately.</p>
            </div>
            <div>
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
    </AdminShell>
  );
}
