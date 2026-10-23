"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/browser";

export default function PublicIntakeForm({ type = "network", jobId = null, compact = false }) {
  const [state, setState] = useState({ status: "idle", message: "" });

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
        setState({ status: "error", message: "Resume must be 10 MB or smaller." });
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
        setState({ status: "error", message: "Resume upload failed. Please try again." });
        return;
      }
      resumeName = resume.name;
      resumeMimeType = resume.type;
    }

    const payload = {
      submission_type: type,
      job_id: type === "application" ? jobId : null,
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim() || null,
      linkedin_url: String(data.get("linkedin_url") || "").trim() || null,
      location: String(data.get("location") || "").trim() || null,
      current_title: String(data.get("current_title") || "").trim() || null,
      current_company: String(data.get("current_company") || "").trim() || null,
      resume_path: resumePath,
      resume_name: resumeName,
      resume_mime_type: resumeMimeType
    };

    const { error } = await supabase.from("public_intake").insert(payload);
    if (error) {
      setState({ status: "error", message: "Submission failed. Please try again." });
      return;
    }

    form.reset();
    setState({
      status: "success",
      message: type === "application"
        ? "Application received. I’ll review your background and follow up if there’s a fit."
        : "You’re in the network. I’ll keep your profile in mind for relevant searches."
    });
  }

  return (
    <form className={compact ? "public-form compact" : "public-form"} onSubmit={submit}>
      <div className="form-grid">
        <label>Full name<input name="full_name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Phone<input name="phone" type="tel" /></label>
        <label>Location<input name="location" /></label>
        <label>Current title<input name="current_title" /></label>
        <label>Current company<input name="current_company" /></label>
      </div>
      <label>LinkedIn<input name="linkedin_url" type="url" placeholder="https://linkedin.com/in/..." /></label>
      <label>Resume<input name="resume" type="file" accept=".pdf,.doc,.docx" /></label>
      <button type="submit" disabled={state.status === "loading"}>
        {state.status === "loading" ? "Submitting..." : type === "application" ? "Apply" : "Join My Network"}
      </button>
      {state.message ? <p className={state.status === "error" ? "form-error" : "form-success"}>{state.message}</p> : null}
    </form>
  );
}
