"use client";

import { useId, useState } from "react";
import { createClient } from "../lib/supabase/browser";

export default function PublicIntakeForm({ type = "network", jobId = null, compact = false }) {
  const [state, setState] = useState({ status: "idle", message: "" });
  const statusId = useId();
  const isApplication = type === "application";

  async function submit(event) {
    event.preventDefault();
    setState({ status: "loading", message: "" });

    const form = event.currentTarget;
    const data = new FormData(form);
    const supabase = createClient();

    let resumePath = null;
    let resumeName = null;
    let resumeMimeType = null;
    const resume = data.get("resume");

    if (resume && resume.size) {
      if (resume.size > 10 * 1024 * 1024) {
        setState({ status: "error", message: "Your résumé must be 10 MB or smaller." });
        return;
      }

      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];

      if (!allowed.includes(resume.type)) {
        setState({ status: "error", message: "Please upload a PDF, DOC or DOCX file." });
        return;
      }

      const safeName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      resumePath = `public-intake/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("resumes").upload(resumePath, resume, {
        upsert: false,
        contentType: resume.type
      });

      if (uploadError) {
        setState({ status: "error", message: "Your résumé could not be uploaded. Please try again." });
        return;
      }

      resumeName = resume.name;
      resumeMimeType = resume.type;
    }

    const linkedinUrl = String(data.get("linkedin_url") || "").trim();

    if (isApplication && !linkedinUrl) {
      setState({ status: "error", message: "Please add your LinkedIn profile to submit this application." });
      return;
    }

    const payload = {
      submission_type: type,
      job_id: isApplication ? jobId : null,
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim() || null,
      linkedin_url: linkedinUrl || null,
      location: String(data.get("location") || "").trim() || null,
      current_title: String(data.get("current_title") || "").trim() || null,
      current_company: String(data.get("current_company") || "").trim() || null,
      resume_path: resumePath,
      resume_name: resumeName,
      resume_mime_type: resumeMimeType
    };

    const { error } = await supabase.from("public_intake").insert(payload);

    if (error) {
      setState({ status: "error", message: "Something went wrong. Your application was not submitted. Please try again." });
      return;
    }

    form.reset();
    setState({
      status: "success",
      message: isApplication
        ? "Application received. Your information is now with the recruiter for review."
        : "You’re in the network. Your profile is available for relevant future searches."
    });
  }

  if (state.status === "success") {
    return (
      <div className="application-success" role="status" aria-live="polite">
        <span className="success-check" aria-hidden="true">✓</span>
        <div>
          <p className="eyebrow">{isApplication ? "Application received" : "Profile received"}</p>
          <h3>{isApplication ? "You’re all set." : "You’re in the network."}</h3>
          <p>{state.message}</p>
          <p className="candidate-next-step">
            {isApplication
              ? "If your background aligns with the search, you’ll hear directly from the recruiter about next steps."
              : "There’s nothing else you need to do right now."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      className={compact ? "public-form compact candidate-form" : "public-form candidate-form"}
      onSubmit={submit}
      aria-describedby={statusId}
    >
      <div className="candidate-form-intro">
        <div>
          <p className="eyebrow">{isApplication ? "Quick application" : "Talent network"}</p>
          <h3>{isApplication ? "Apply in a few minutes." : "Share your background."}</h3>
        </div>
        <span>No account required</span>
      </div>

      <fieldset className="candidate-form-section">
        <legend>Contact</legend>
        <div className="form-grid">
          <label>
            Full name <span aria-hidden="true">*</span>
            <input name="full_name" autoComplete="name" required />
          </label>
          <label>
            Email <span aria-hidden="true">*</span>
            <input name="email" type="email" autoComplete="email" inputMode="email" required />
          </label>
          <label>
            Phone <span className="optional-label">Optional</span>
            <input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
          </label>
          <label>
            Location <span className="optional-label">Optional</span>
            <input name="location" autoComplete="address-level2" placeholder="City, State" />
          </label>
        </div>
      </fieldset>

      <fieldset className="candidate-form-section">
        <legend>Professional background</legend>
        <div className="form-grid">
          <label>
            Current title <span className="optional-label">Optional</span>
            <input name="current_title" autoComplete="organization-title" />
          </label>
          <label>
            Current company <span className="optional-label">Optional</span>
            <input name="current_company" autoComplete="organization" />
          </label>
        </div>

        <label>
          LinkedIn {isApplication ? <span aria-hidden="true">*</span> : <span className="optional-label">Optional</span>}
          <input
            name="linkedin_url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://linkedin.com/in/..."
            required={isApplication}
          />
        </label>

        <label className="resume-upload">
          <span>
            Résumé <span className="optional-label">PDF, DOC or DOCX · up to 10 MB</span>
          </span>
          <input name="resume" type="file" accept=".pdf,.doc,.docx" />
        </label>
      </fieldset>

      <div className="candidate-submit-row">
        <button type="submit" disabled={state.status === "loading"}>
          {state.status === "loading"
            ? "Submitting..."
            : isApplication
              ? "Submit application"
              : "Join talent network"}
        </button>
        <p>Your information is submitted directly to the recruiting team and is not displayed publicly.</p>
      </div>

      <p
        id={statusId}
        className={state.status === "error" ? "form-error form-status" : "form-status"}
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
