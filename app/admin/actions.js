"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { requireRecruiter } from "../../lib/auth";
import { createGoogleCalendarEvent, sendGoogleEmail } from "../../lib/google";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];

function clean(value) {
  const v = String(value || "").trim();
  return v || null;
}

function numberOrNull(value) {
  const v = clean(value);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function localDateTimeToIso(value) {
  const v = clean(value);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
    return new Date(`${v}:00-04:00`).toISOString();
  }
  return new Date(v).toISOString();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function createJob(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const title = clean(formData.get("title"));
  if (!title) return;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      owner_id: recruiter.id,
      organization_id: recruiter.organization_id,
      title,
      department: clean(formData.get("department")),
      client_name: clean(formData.get("client_name")),
      hiring_manager: clean(formData.get("hiring_manager")),
      client_contact: clean(formData.get("client_contact")),
      internal_notes: clean(formData.get("internal_notes")),
      interview_stages: [],
      status: "draft"
    })
    .select("id")
    .single();

  if (error) throw error;

  const baseSlug = slugify(title) || "role";
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data: existingSlug, error: slugError } = await supabase
      .from("job_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugError) throw slugError;
    if (!existingSlug) break;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { error: postError } = await supabase.from("job_posts").insert({
    job_id: job.id,
    slug,
    title,
    department: clean(formData.get("department")),
    published: false,
    published_at: null
  });

  if (postError) throw postError;

  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${job.id}`);
}

export async function addCandidate(formData) {
  const { recruiter, supabase } = await requireRecruiter();

  const email = clean(formData.get("email"));
  const linkedin = clean(formData.get("linkedin_url"));

  let existing = null;
  if (email) {
    const { data } = await supabase.from("candidates").select("id").eq("email_normalized", email.toLowerCase()).maybeSingle();
    existing = data;
  }
  if (!existing && linkedin) {
    const normalized = linkedin.toLowerCase().replace(/\/$/, "");
    const { data } = await supabase.from("candidates").select("id").eq("linkedin_normalized", normalized).maybeSingle();
    existing = data;
  }

  if (existing) redirect(`/admin/candidates/${existing.id}`);

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      full_name: clean(formData.get("full_name")),
      email,
      phone: clean(formData.get("phone")),
      linkedin_url: linkedin,
      location: clean(formData.get("location")),
      current_title: clean(formData.get("current_title")),
      current_company: clean(formData.get("current_company")),
      source: clean(formData.get("source")) || "recruiter",
      created_by: recruiter.id,
      owner_id: recruiter.id,
      organization_id: recruiter.organization_id
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/admin/candidates");
  redirect(`/admin/candidates/${candidate.id}`);
}

export async function processIntake(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const intakeId = clean(formData.get("intake_id"));
  if (!intakeId) return;

  const { data: intake, error } = await supabase
    .from("public_intake")
    .select("*")
    .eq("id", intakeId)
    .eq("status", "new")
    .single();
  if (error || !intake) return;

  const emailNorm = intake.email?.trim().toLowerCase();
  const linkedinNorm = intake.linkedin_url?.trim().toLowerCase().replace(/\/$/, "");

  let candidate = null;
  if (emailNorm) {
    const { data } = await supabase.from("candidates").select("id").eq("email_normalized", emailNorm).maybeSingle();
    candidate = data;
  }
  if (!candidate && linkedinNorm) {
    const { data } = await supabase.from("candidates").select("id").eq("linkedin_normalized", linkedinNorm).maybeSingle();
    candidate = data;
  }

  if (!candidate) {
    const { data, error: insertError } = await supabase.from("candidates").insert({
      full_name: intake.full_name,
      email: intake.email,
      phone: intake.phone,
      linkedin_url: intake.linkedin_url,
      location: intake.location,
      current_title: intake.current_title,
      current_company: intake.current_company,
      source: intake.submission_type === "application" ? "website_application" : "website_network",
      owner_id: recruiter.id,
      organization_id: intake.organization_id || recruiter.organization_id,
      latest_resume_path: intake.resume_path,
      latest_resume_name: intake.resume_name,
      latest_resume_mime_type: intake.resume_mime_type,
      latest_resume_uploaded_at: intake.resume_path ? new Date().toISOString() : null
    }).select("id").single();
    if (insertError) throw insertError;
    candidate = data;
  } else {
    const { error: candidateUpdateError } = await supabase.from("candidates").update({
      phone: intake.phone || undefined,
      linkedin_url: intake.linkedin_url || undefined,
      location: intake.location || undefined,
      current_title: intake.current_title || undefined,
      current_company: intake.current_company || undefined,
      latest_resume_path: intake.resume_path || undefined,
      latest_resume_name: intake.resume_name || undefined,
      latest_resume_mime_type: intake.resume_mime_type || undefined,
      latest_resume_uploaded_at: intake.resume_path ? new Date().toISOString() : undefined
    }).eq("id", candidate.id);

    if (candidateUpdateError) throw candidateUpdateError;
  }

  let documentId = null;
  if (intake.resume_path) {
    const { data: existingDocument } = await supabase
      .from("candidate_documents")
      .select("id")
      .eq("storage_path", intake.resume_path)
      .maybeSingle();

    if (existingDocument) {
      documentId = existingDocument.id;
    } else {
      const { data: document, error: documentError } = await supabase
        .from("candidate_documents")
        .insert({
          candidate_id: candidate.id,
          recruiter_id: recruiter.id,
          document_type: "resume",
          file_name: intake.resume_name || "Resume",
          storage_path: intake.resume_path,
          mime_type: intake.resume_mime_type,
          label: "Website application résumé",
          is_primary: true
        })
        .select("id")
        .single();

      if (documentError) throw documentError;
      documentId = document.id;

      const { error: primaryError } = await supabase.from("candidate_documents")
        .update({ is_primary: false })
        .eq("candidate_id", candidate.id)
        .neq("id", document.id);

      if (primaryError) throw primaryError;
    }
  }

  let applicationId = null;
  if (intake.submission_type === "application" && intake.job_id) {
    const { data: application, error: appError } = await supabase.from("applications")
      .upsert({
        candidate_id: candidate.id,
        job_id: intake.job_id,
        stage: "Applied",
        source: "website",
        organization_id: intake.organization_id || recruiter.organization_id,
        resume_document_id: documentId,
        updated_at: new Date().toISOString()
      }, { onConflict: "candidate_id,job_id" })
      .select("id")
      .single();
    if (appError) throw appError;
    applicationId = application.id;
  }

  await supabase.from("activities").insert({
    candidate_id: candidate.id,
    application_id: applicationId,
    activity_type: intake.submission_type === "application" ? "application_received" : "joined_network",
    details: { source: "website", intake_id: intake.id }
  });

  const { error: intakeUpdateError } = await supabase.from("public_intake").update({
    status: "processed",
    processed_at: new Date().toISOString()
  }).eq("id", intake.id);

  if (intakeUpdateError) throw intakeUpdateError;

  revalidatePath("/admin/candidates");
  revalidatePath("/admin/dashboard");
  if (intake.job_id) revalidatePath(`/admin/jobs/${intake.job_id}`);
}

export async function updateApplicationStage(formData) {
  const { supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const stage = clean(formData.get("stage"));
  const interviewStage = clean(formData.get("interview_stage"));
  if (!applicationId || !STAGES.includes(stage)) return;

  const { data: before } = await supabase.from("applications").select("candidate_id, job_id, stage").eq("id", applicationId).single();

  const { error: updateError } = await supabase.from("applications").update({
    stage,
    interview_stage: stage === "Interviewing" ? interviewStage : null,
    updated_at: new Date().toISOString()
  }).eq("id", applicationId);

  if (updateError) throw updateError;

  if (before) {
    await supabase.from("activities").insert({
      candidate_id: before.candidate_id,
      application_id: applicationId,
      activity_type: "stage_changed",
      details: { from: before.stage, to: stage, interview_stage: interviewStage }
    });
    revalidatePath(`/admin/jobs/${before.job_id}`);
    revalidatePath(`/admin/candidates/${before.candidate_id}`);
  }
}

export async function addCandidateNote(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const body = clean(formData.get("body"));
  if (!candidateId || !body) return;

  await supabase.from("candidate_notes").insert({
    candidate_id: candidateId,
    author_id: recruiter.id,
    body
  });

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "note_added",
    details: {}
  });

  revalidatePath(`/admin/candidates/${candidateId}`);
}


export async function attachCandidateToJob(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const jobId = clean(formData.get("job_id"));
  if (!candidateId || !jobId) return;

  const { error } = await supabase.from("applications").upsert({
    candidate_id: candidateId,
    job_id: jobId,
    stage: "Applied",
    source: "recruiter",
    organization_id: recruiter.organization_id,
    updated_at: new Date().toISOString()
  }, { onConflict: "candidate_id,job_id" });

  if (error) throw error;

  revalidatePath(`/admin/candidates/${candidateId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
}


export async function updateJobStatus(formData) {
  const { supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  const status = clean(formData.get("status"));
  if (!jobId || !["draft","published","paused","closed"].includes(status)) return;

  await supabase.from("jobs").update({
    status,
    updated_at: new Date().toISOString()
  }).eq("id", jobId);

  await supabase.from("job_posts").update({
    published: status === "published",
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq("job_id", jobId);

  revalidatePath("/");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}


export async function updateJob(formData) {
  const { supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  if (!jobId) return;

  const interviewStages = String(formData.get("interview_stages") || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const { error } = await supabase.from("jobs").update({
    title: clean(formData.get("title")),
    department: clean(formData.get("department")),
    client_name: clean(formData.get("client_name")),
    hiring_manager: clean(formData.get("hiring_manager")),
    client_contact: clean(formData.get("client_contact")),
    internal_notes: clean(formData.get("internal_notes")),
    interview_stages: interviewStages,
    updated_at: new Date().toISOString()
  }).eq("id", jobId);

  if (error) throw error;

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function updatePublicPosting(formData) {
  const { supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  const intent = clean(formData.get("intent")) || "save";
  if (!jobId) return;

  const payload = {
    title: clean(formData.get("public_title")),
    department: clean(formData.get("department")),
    location: clean(formData.get("location")),
    workplace: clean(formData.get("workplace")),
    employment_type: clean(formData.get("employment_type")),
    compensation: clean(formData.get("compensation")),
    short_summary: clean(formData.get("short_summary")),
    description: clean(formData.get("description")),
    responsibilities: clean(formData.get("responsibilities")),
    requirements: clean(formData.get("requirements")),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("job_posts")
    .update(payload)
    .eq("job_id", jobId);

  if (error) throw error;

  if (intent === "publish") {
    const missing = [];
    if (!payload.title) missing.push("Public title");
    if (!payload.location) missing.push("Location");
    if (!payload.short_summary) missing.push("Short summary");
    if (!payload.description) missing.push("About the role");

    if (missing.length) {
      redirect(`/admin/jobs/${jobId}?publish_error=${encodeURIComponent("Complete before publishing: " + missing.join(", "))}#publish`);
    }

    const now = new Date().toISOString();
    const [{ error: jobError }, { error: publishError }] = await Promise.all([
      supabase.from("jobs").update({ status: "published", updated_at: now }).eq("id", jobId),
      supabase.from("job_posts").update({
        published: true,
        published_at: now,
        updated_at: now
      }).eq("job_id", jobId)
    ]);

    if (jobError) throw jobError;
    if (publishError) throw publishError;

    revalidatePath("/");
    revalidatePath("/admin/jobs");
    revalidatePath(`/admin/jobs/${jobId}`);
    redirect(`/admin/jobs/${jobId}?published=1#publish`);
  }

  revalidatePath("/");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function setPublicPostingState(formData) {
  const { supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  const intent = clean(formData.get("intent"));
  if (!jobId || !["publish","unpublish","close"].includes(intent)) return;

  const { data: post, error: postError } = await supabase
    .from("job_posts")
    .select("title, location, short_summary, description, published, published_at")
    .eq("job_id", jobId)
    .single();

  if (postError) throw postError;

  if (intent === "publish") {
    const missing = [];
    if (!post.title) missing.push("title");
    if (!post.location) missing.push("location");
    if (!post.short_summary) missing.push("summary");
    if (!post.description) missing.push("description");

    if (missing.length) {
      redirect(`/admin/jobs/${jobId}?publish_error=${encodeURIComponent("Complete before publishing: " + missing.join(", "))}#publish`);
    }

    const now = new Date().toISOString();

    const [{ error: jobError }, { error: publishError }] = await Promise.all([
      supabase.from("jobs").update({ status: "published", updated_at: now }).eq("id", jobId),
      supabase.from("job_posts").update({
        published: true,
        published_at: post.published_at || now,
        updated_at: now
      }).eq("job_id", jobId)
    ]);

    if (jobError) throw jobError;
    if (publishError) throw publishError;
  }

  if (intent === "unpublish") {
    const now = new Date().toISOString();
    const [{ error: jobError }, { error: publishError }] = await Promise.all([
      supabase.from("jobs").update({ status: "paused", updated_at: now }).eq("id", jobId),
      supabase.from("job_posts").update({ published: false, updated_at: now }).eq("job_id", jobId)
    ]);
    if (jobError) throw jobError;
    if (publishError) throw publishError;
  }

  if (intent === "close") {
    const now = new Date().toISOString();
    const [{ error: jobError }, { error: publishError }] = await Promise.all([
      supabase.from("jobs").update({ status: "closed", updated_at: now }).eq("id", jobId),
      supabase.from("job_posts").update({ published: false, updated_at: now }).eq("job_id", jobId)
    ]);
    if (jobError) throw jobError;
    if (publishError) throw publishError;
  }

  revalidatePath("/");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}


export async function updateCandidate(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const fullName = clean(formData.get("full_name"));
  if (!candidateId || !fullName) return;

  const { error } = await supabase.from("candidates").update({
    full_name: fullName,
    email: clean(formData.get("email")),
    phone: clean(formData.get("phone")),
    linkedin_url: clean(formData.get("linkedin_url")),
    location: clean(formData.get("location")),
    current_title: clean(formData.get("current_title")),
    current_company: clean(formData.get("current_company")),
    source: clean(formData.get("source")) || "other",
    updated_at: new Date().toISOString()
  }).eq("id", candidateId);

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "candidate_updated",
    details: {}
  });

  revalidatePath("/admin/candidates");
  revalidatePath(`/admin/candidates/${candidateId}`);
}


export async function createInterview(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const stageName = clean(formData.get("stage_name"));
  const scheduledAt = clean(formData.get("scheduled_at"));
  const durationMinutes = Number(formData.get("duration_minutes") || 30);
  const meetingUrl = clean(formData.get("meeting_url"));
  if (!applicationId || !stageName || !Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id, job_id")
    .eq("id", applicationId)
    .single();

  if (appError) throw appError;

  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({
      application_id: applicationId,
      stage_name: stageName,
      scheduled_at: localDateTimeToIso(scheduledAt),
      status: "scheduled",
      notes: clean(formData.get("notes")),
      duration_minutes: durationMinutes,
      meeting_url: meetingUrl,
      created_by: recruiter.id
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: stageError } = await supabase.from("applications").update({
    stage: "Interviewing",
    interview_stage: stageName,
    updated_at: new Date().toISOString()
  }).eq("id", applicationId);

  if (stageError) throw stageError;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "interview_scheduled",
    details: {
      interview_id: interview.id,
      stage_name: stageName,
      scheduled_at: scheduledAt || null,
      duration_minutes: durationMinutes,
      meeting_url: meetingUrl
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
}

export async function updateInterview(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const interviewId = clean(formData.get("interview_id"));
  const status = clean(formData.get("status"));
  const scheduledAt = clean(formData.get("scheduled_at"));
  const stageName = clean(formData.get("stage_name"));
  const durationMinutes = Number(formData.get("duration_minutes") || 30);
  const meetingUrl = clean(formData.get("meeting_url"));
  if (!interviewId || !stageName || !Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480 || !["scheduled","completed","cancelled","no_show"].includes(status)) return;

  const { data: interview, error: fetchError } = await supabase
    .from("interviews")
    .select("application_id")
    .eq("id", interviewId)
    .single();

  if (fetchError) throw fetchError;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id, job_id")
    .eq("id", interview.application_id)
    .single();

  if (appError) throw appError;

  const { error } = await supabase.from("interviews").update({
    stage_name: stageName,
    scheduled_at: localDateTimeToIso(scheduledAt),
    status,
    notes: clean(formData.get("notes")),
    duration_minutes: durationMinutes,
    meeting_url: meetingUrl,
    updated_at: new Date().toISOString()
  }).eq("id", interviewId);

  if (error) throw error;

  if (status !== "cancelled") {
    const { error: stageError } = await supabase.from("applications").update({
      stage: "Interviewing",
      interview_stage: stageName,
      updated_at: new Date().toISOString()
    }).eq("id", interview.application_id);

    if (stageError) throw stageError;
  }

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: interview.application_id,
    actor_id: recruiter.id,
    activity_type: "interview_updated",
    details: {
      interview_id: interviewId,
      stage_name: stageName,
      status,
      scheduled_at: scheduledAt || null,
      duration_minutes: durationMinutes,
      meeting_url: meetingUrl
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
}


export async function createTask(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const title = clean(formData.get("title"));
  if (!title) return;

  const candidateId = clean(formData.get("candidate_id"));
  const jobId = clean(formData.get("job_id"));
  const taskType = clean(formData.get("task_type")) || "other";
  const priority = clean(formData.get("priority")) || "medium";
  const dueAt = clean(formData.get("due_at"));
  const ownerId = clean(formData.get("owner_id")) || recruiter.id;

  const allowedTypes = ["follow_up_candidate","follow_up_client","schedule_interview","send_submission","check_feedback","other"];
  if (!allowedTypes.includes(taskType) || !["low","medium","high"].includes(priority)) return;

  const { data: taskOwner, error: ownerError } = await supabase
    .from("recruiters")
    .select("id")
    .eq("id", ownerId)
    .eq("organization_id", recruiter.organization_id)
    .eq("active", true)
    .single();

  if (ownerError || !taskOwner) throw ownerError || new Error("Invalid task owner");

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      owner_id: ownerId,
      organization_id: recruiter.organization_id,
      candidate_id: candidateId,
      job_id: jobId,
      task_type: taskType,
      title,
      notes: clean(formData.get("notes")),
      priority,
      status: "open",
      due_at: localDateTimeToIso(dueAt)
    })
    .select("id")
    .single();

  if (error) throw error;

  if (candidateId) {
    await supabase.from("activities").insert({
      candidate_id: candidateId,
      actor_id: recruiter.id,
      activity_type: "task_created",
      details: { task_id: task.id, title, task_type: taskType, due_at: dueAt || null }
    });
    revalidatePath(`/admin/candidates/${candidateId}`);
  }

  if (jobId) revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
}

export async function updateTaskStatus(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const taskId = clean(formData.get("task_id"));
  const status = clean(formData.get("status"));
  if (!taskId || !["open","done"].includes(status)) return;

  const { data: before, error: fetchError } = await supabase
    .from("tasks")
    .select("candidate_id,job_id,title,status")
    .eq("id", taskId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase.from("tasks").update({
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq("id", taskId);

  if (error) throw error;

  if (before.candidate_id) {
    await supabase.from("activities").insert({
      candidate_id: before.candidate_id,
      actor_id: recruiter.id,
      activity_type: status === "done" ? "task_completed" : "task_reopened",
      details: { task_id: taskId, title: before.title }
    });
    revalidatePath(`/admin/candidates/${before.candidate_id}`);
  }

  if (before.job_id) revalidatePath(`/admin/jobs/${before.job_id}`);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
}


export async function sendCandidateEmail(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const subject = clean(formData.get("subject"));
  const body = clean(formData.get("body"));
  if (!candidateId || !subject || !body) return;

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id,full_name,email")
    .eq("id", candidateId)
    .single();

  if (candidateError) throw candidateError;
  if (!candidate.email) throw new Error("Candidate does not have an email address");

  const message = await sendGoogleEmail({
    supabase,
    recruiterId: recruiter.id,
    to: candidate.email,
    subject,
    body
  });

  const { error: communicationError } = await supabase.from("communications").insert({
    recruiter_id: recruiter.id,
    candidate_id: candidateId,
    channel: "email",
    direction: "outbound",
    subject,
    body,
    recipient: candidate.email,
    provider: "google",
    provider_message_id: message.id || null,
    status: "sent",
    occurred_at: new Date().toISOString(),
    metadata: { thread_id: message.threadId || null }
  });

  if (communicationError) throw communicationError;

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "email_sent",
    details: { subject, provider_message_id: message.id || null }
  });

  revalidatePath(`/admin/candidates/${candidateId}`);
  revalidatePath("/admin/dashboard");
}

export async function createInterviewCalendarEvent(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const interviewId = clean(formData.get("interview_id"));
  if (!interviewId) return;

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id,stage_name,scheduled_at,duration_minutes,meeting_url,notes,google_event_id,google_calendar_link,application:applications(id,candidate:candidates(id,full_name,email),job:jobs(id,title))")
    .eq("id", interviewId)
    .single();

  if (error) throw error;
  if (!interview.scheduled_at) throw new Error("Schedule the interview before creating a calendar event");

  if (interview.google_event_id) {
    revalidatePath(`/admin/candidates/${interview.application.candidate.id}`);
    return;
  }

  const event = await createGoogleCalendarEvent({
    supabase,
    recruiterId: recruiter.id,
    summary: `${interview.stage_name}: ${interview.application.candidate.full_name} — ${interview.application.job.title}`,
    description: [
      `Candidate: ${interview.application.candidate.full_name}`,
      `Role: ${interview.application.job.title}`,
      interview.notes || null,
      interview.meeting_url ? `Meeting: ${interview.meeting_url}` : null
    ].filter(Boolean).join("\n\n"),
    start: interview.scheduled_at,
    durationMinutes: interview.duration_minutes || 30,
    meetingUrl: interview.meeting_url,
    attendeeEmail: interview.application.candidate.email || undefined
  });

  const { error: updateError } = await supabase.from("interviews").update({
    google_event_id: event.id || null,
    google_calendar_link: event.htmlLink || null,
    updated_at: new Date().toISOString()
  }).eq("id", interviewId);

  if (updateError) throw updateError;

  const { error: communicationError } = await supabase.from("communications").insert({
    recruiter_id: recruiter.id,
    candidate_id: interview.application.candidate.id,
    job_id: interview.application.job.id,
    application_id: interview.application.id,
    interview_id: interviewId,
    channel: "calendar",
    direction: "system",
    subject: `${interview.stage_name}: ${interview.application.candidate.full_name}`,
    recipient: interview.application.candidate.email || null,
    provider: "google",
    provider_event_id: event.id || null,
    status: "created",
    occurred_at: new Date().toISOString(),
    metadata: { html_link: event.htmlLink || null }
  });

  if (communicationError) throw communicationError;

  await supabase.from("activities").insert({
    candidate_id: interview.application.candidate.id,
    application_id: interview.application.id,
    actor_id: recruiter.id,
    activity_type: "calendar_event_created",
    details: {
      interview_id: interviewId,
      provider_event_id: event.id || null
    }
  });

  revalidatePath(`/admin/candidates/${interview.application.candidate.id}`);
  revalidatePath(`/admin/jobs/${interview.application.job.id}`);
  revalidatePath("/admin/dashboard");
}


export async function saveCandidateSubmission(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const intent = clean(formData.get("intent")) || "draft";
  if (!applicationId || !["draft","ready","submitted"].includes(intent)) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("id,candidate_id,job_id")
    .eq("id", applicationId)
    .single();

  if (appError) throw appError;

  const now = new Date().toISOString();

  const payload = {
    application_id: applicationId,
    recruiter_id: recruiter.id,
    status: intent,
    recruiter_summary: clean(formData.get("recruiter_summary")),
    key_strengths: clean(formData.get("key_strengths")),
    compensation: clean(formData.get("compensation")),
    availability: clean(formData.get("availability")),
    work_authorization: clean(formData.get("work_authorization")),
    visa_sponsorship: clean(formData.get("visa_sponsorship")),
    relocation: clean(formData.get("relocation")),
    location_preference: clean(formData.get("location_preference")),
    notice_period: clean(formData.get("notice_period")),
    client_notes: clean(formData.get("client_notes")),
    submitted_at: intent === "submitted" ? now : null,
    updated_at: now
  };

  const { data: submission, error } = await supabase
    .from("candidate_submissions")
    .upsert(payload, { onConflict: "application_id" })
    .select("id,status")
    .single();

  if (error) throw error;

  if (intent === "submitted") {
    const { error: stageError } = await supabase.from("applications").update({
      stage: "Client Sub",
      interview_stage: null,
      updated_at: now
    }).eq("id", applicationId);

    if (stageError) throw stageError;
  }

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type:
      intent === "submitted"
        ? "candidate_submitted"
        : intent === "ready"
          ? "submission_ready"
          : "submission_draft_saved",
    details: {
      submission_id: submission.id,
      status: intent
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
  revalidatePath("/admin/dashboard");
}


export async function addClientFeedback(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const feedbackType = clean(formData.get("feedback_type")) || "general";
  const feedback = clean(formData.get("feedback"));
  const reason = clean(formData.get("reason"));
  const nextStep = clean(formData.get("next_step"));
  if (!applicationId || !["general","advance","hold","reject"].includes(feedbackType)) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id,job_id")
    .eq("id", applicationId)
    .single();
  if (appError) throw appError;

  const { data: row, error } = await supabase.from("client_feedback").insert({
    application_id: applicationId,
    recruiter_id: recruiter.id,
    feedback_type: feedbackType,
    feedback,
    reason,
    next_step: nextStep
  }).select("id").single();
  if (error) throw error;

  const now = new Date().toISOString();

  if (feedbackType === "reject") {
    const { error: updateError } = await supabase.from("applications").update({
      stage: "Rejected",
      interview_stage: null,
      disposition: "rejected",
      disposition_reason: reason || feedback,
      disposition_at: now,
      updated_at: now
    }).eq("id", applicationId);
    if (updateError) throw updateError;
  } else if (feedbackType === "advance") {
    const { error: updateError } = await supabase.from("applications").update({
      disposition: "advanced",
      disposition_reason: reason || nextStep,
      disposition_at: now,
      updated_at: now
    }).eq("id", applicationId);
    if (updateError) throw updateError;
  } else if (feedbackType === "hold") {
    const { error: updateError } = await supabase.from("applications").update({
      disposition: "hold",
      disposition_reason: reason || feedback,
      disposition_at: now,
      updated_at: now
    }).eq("id", applicationId);
    if (updateError) throw updateError;
  }

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "client_feedback_added",
    details: { feedback_id: row.id, feedback_type: feedbackType, reason, next_step: nextStep }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
  revalidatePath("/admin/dashboard");
}


export async function saveOffer(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const offerId = clean(formData.get("offer_id"));
  const status = clean(formData.get("status")) || "draft";
  if (!applicationId || !["draft","extended","accepted","declined","withdrawn"].includes(status)) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id,job_id")
    .eq("id", applicationId)
    .single();
  if (appError) throw appError;

  const now = new Date().toISOString();
  const payload = {
    application_id: applicationId,
    recruiter_id: recruiter.id,
    status,
    base_salary: numberOrNull(formData.get("base_salary")),
    bonus: numberOrNull(formData.get("bonus")),
    total_comp: numberOrNull(formData.get("total_comp")),
    currency: clean(formData.get("currency")) || "USD",
    equity: clean(formData.get("equity")),
    sign_on_bonus: numberOrNull(formData.get("sign_on_bonus")),
    start_date: clean(formData.get("start_date")),
    expiration_date: clean(formData.get("expiration_date")),
    notes: clean(formData.get("notes")),
    extended_at: status === "extended" || status === "accepted" || status === "declined"
      ? clean(formData.get("extended_at")) || now
      : null,
    responded_at: ["accepted","declined"].includes(status) ? now : null,
    updated_at: now
  };

  let offer;
  if (offerId) {
    const { data, error } = await supabase
      .from("offers")
      .update(payload)
      .eq("id", offerId)
      .select("*")
      .single();
    if (error) throw error;
    offer = data;
  } else {
    const { data, error } = await supabase
      .from("offers")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    offer = data;
  }

  let nextStage = null;
  if (status === "extended") nextStage = "Offer";
  if (status === "accepted") nextStage = "Placed";

  if (nextStage) {
    const { error: stageError } = await supabase.from("applications").update({
      stage: nextStage,
      interview_stage: null,
      disposition: status === "accepted" ? "placed" : null,
      disposition_reason: status === "accepted" ? "Offer accepted" : null,
      disposition_at: status === "accepted" ? now : null,
      updated_at: now
    }).eq("id", applicationId);
    if (stageError) throw stageError;
  }

  if (status === "accepted") {
    const placedComp = offer.total_comp ?? offer.base_salary ?? null;
    const { error: placementError } = await supabase.from("placements").upsert({
      application_id: applicationId,
      offer_id: offer.id,
      recruiter_id: recruiter.id,
      start_date: offer.start_date,
      placed_compensation: placedComp,
      currency: offer.currency || "USD",
      updated_at: now
    }, { onConflict: "application_id" });
    if (placementError) throw placementError;
  }

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type:
      status === "accepted" ? "offer_accepted"
      : status === "declined" ? "offer_declined"
      : status === "extended" ? "offer_extended"
      : "offer_saved",
    details: {
      offer_id: offer.id,
      status,
      base_salary: offer.base_salary,
      total_comp: offer.total_comp,
      start_date: offer.start_date
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
  revalidatePath("/admin/dashboard");
}

export async function savePlacement(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  if (!applicationId) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id,job_id")
    .eq("id", applicationId)
    .single();
  if (appError) throw appError;

  const feeType = clean(formData.get("fee_type"));
  if (feeType && !["percentage","flat"].includes(feeType)) return;

  const placedComp = numberOrNull(formData.get("placed_compensation"));
  const feePercentage = numberOrNull(formData.get("fee_percentage"));
  const flatFee = numberOrNull(formData.get("estimated_fee"));
  const estimatedFee =
    feeType === "percentage" && placedComp !== null && feePercentage !== null
      ? Math.round((placedComp * feePercentage / 100) * 100) / 100
      : flatFee;

  const invoiceStatus = clean(formData.get("invoice_status")) || "not_invoiced";
  if (!["not_invoiced","invoiced","paid","adjusted","cancelled"].includes(invoiceStatus)) return;

  const now = new Date().toISOString();
  const { data: placement, error } = await supabase.from("placements").upsert({
    application_id: applicationId,
    recruiter_id: recruiter.id,
    start_date: clean(formData.get("start_date")),
    placed_compensation: placedComp,
    currency: clean(formData.get("currency")) || "USD",
    fee_type: feeType,
    fee_percentage: feePercentage,
    estimated_fee: estimatedFee,
    final_fee: numberOrNull(formData.get("final_fee")),
    invoice_status: invoiceStatus,
    invoice_date: clean(formData.get("invoice_date")),
    payment_date: clean(formData.get("payment_date")),
    guarantee_end_date: clean(formData.get("guarantee_end_date")),
    notes: clean(formData.get("notes")),
    updated_at: now
  }, { onConflict: "application_id" }).select("*").single();

  if (error) throw error;

  const { error: stageError } = await supabase.from("applications").update({
    stage: "Placed",
    interview_stage: null,
    disposition: "placed",
    disposition_reason: "Placement recorded",
    disposition_at: now,
    updated_at: now
  }).eq("id", applicationId);
  if (stageError) throw stageError;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "placement_updated",
    details: {
      placement_id: placement.id,
      start_date: placement.start_date,
      estimated_fee: placement.estimated_fee,
      final_fee: placement.final_fee,
      invoice_status: placement.invoice_status
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
  revalidatePath("/admin/dashboard");
}


function safeStorageName(value) {
  return String(value || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "document";
}

export async function uploadCandidateDocument(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const documentType = clean(formData.get("document_type")) || "resume";
  const label = clean(formData.get("label"));
  const notes = clean(formData.get("notes"));
  const makePrimary = String(formData.get("make_primary") || "") === "on";
  const file = formData.get("file");

  if (!candidateId || !["resume","cover_letter","other"].includes(documentType)) return;
  if (!file || typeof file !== "object" || !file.name || !file.size) return;

  const allowedMime = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Document exceeds the 10 MB limit");
  }

  if (documentType === "resume" && !allowedMime.includes(file.type)) {
    throw new Error("Résumé must be PDF, DOC, or DOCX");
  }

  const path = `candidates/${candidateId}/${Date.now()}-${safeStorageName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { count } = await supabase
    .from("candidate_documents")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("document_type", "resume")
    .eq("is_primary", true);

  const shouldBePrimary = documentType === "resume" && (makePrimary || !count);

  if (shouldBePrimary) {
    await supabase.from("candidate_documents")
      .update({ is_primary: false })
      .eq("candidate_id", candidateId)
      .eq("document_type", "resume");
  }

  const { data: document, error: documentError } = await supabase
    .from("candidate_documents")
    .insert({
      candidate_id: candidateId,
      recruiter_id: recruiter.id,
      document_type: documentType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      file_size: file.size,
      label,
      notes,
      is_primary: shouldBePrimary
    })
    .select("id")
    .single();

  if (documentError) {
    await supabase.storage.from("resumes").remove([path]);
    throw documentError;
  }

  if (shouldBePrimary) {
    const { error: candidateError } = await supabase.from("candidates").update({
      latest_resume_path: path,
      latest_resume_name: file.name,
      latest_resume_mime_type: file.type || null,
      latest_resume_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", candidateId);

    if (candidateError) throw candidateError;
  }

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "document_uploaded",
    details: { document_id: document.id, document_type: documentType, file_name: file.name, primary: shouldBePrimary }
  });

  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function setPrimaryCandidateResume(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const documentId = clean(formData.get("document_id"));
  if (!candidateId || !documentId) return;

  const { data: document, error } = await supabase
    .from("candidate_documents")
    .select("id,candidate_id,document_type,file_name,storage_path,mime_type")
    .eq("id", documentId)
    .eq("candidate_id", candidateId)
    .single();

  if (error) throw error;
  if (document.document_type !== "resume") return;

  const { error: clearError } = await supabase.from("candidate_documents")
    .update({ is_primary: false })
    .eq("candidate_id", candidateId)
    .eq("document_type", "resume");
  if (clearError) throw clearError;

  const { error: setError } = await supabase.from("candidate_documents")
    .update({ is_primary: true })
    .eq("id", documentId);
  if (setError) throw setError;

  const { error: candidateError } = await supabase.from("candidates").update({
    latest_resume_path: document.storage_path,
    latest_resume_name: document.file_name,
    latest_resume_mime_type: document.mime_type,
    latest_resume_uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", candidateId);
  if (candidateError) throw candidateError;

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "primary_resume_changed",
    details: { document_id: documentId }
  });

  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function assignApplicationResume(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const documentId = clean(formData.get("document_id"));
  if (!applicationId) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("id,candidate_id,job_id")
    .eq("id", applicationId)
    .single();
  if (appError) throw appError;

  if (documentId) {
    const { data: document, error: documentError } = await supabase
      .from("candidate_documents")
      .select("id,candidate_id,document_type")
      .eq("id", documentId)
      .single();
    if (documentError) throw documentError;
    if (document.candidate_id !== application.candidate_id || document.document_type !== "resume") {
      throw new Error("Selected résumé does not belong to this candidate");
    }
  }

  const { error } = await supabase.from("applications").update({
    resume_document_id: documentId,
    updated_at: new Date().toISOString()
  }).eq("id", applicationId);
  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "application_resume_assigned",
    details: { document_id: documentId }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
}


export async function createCandidatePortalAccess(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  if (!applicationId) return;

  const { data: application, error } = await supabase
    .from("applications")
    .select("id,candidate_id,job_id")
    .eq("id", applicationId)
    .single();

  if (error) throw error;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();

  const { error: accessError } = await supabase
    .from("candidate_portal_access")
    .upsert({
      application_id: applicationId,
      candidate_id: application.candidate_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      revoked_at: null,
      created_by: recruiter.id
    }, { onConflict: "application_id" });

  if (accessError) throw accessError;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "candidate_portal_link_created",
    details: { expires_at: expiresAt }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  redirect(`/admin/candidates/${application.candidate_id}?portal_token=${encodeURIComponent(token)}&portal_app=${applicationId}`);
}

export async function revokeCandidatePortalAccess(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  if (!applicationId) return;

  const { data: application, error } = await supabase
    .from("applications")
    .select("candidate_id,job_id")
    .eq("id", applicationId)
    .single();

  if (error) throw error;

  const { error: revokeError } = await supabase
    .from("candidate_portal_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("application_id", applicationId);

  if (revokeError) throw revokeError;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "candidate_portal_access_revoked",
    details: {}
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
}


export async function addCandidatePortalUpdate(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const applicationId = clean(formData.get("application_id"));
  const updateType = clean(formData.get("update_type")) || "general";
  const title = clean(formData.get("title"));
  const body = clean(formData.get("body"));

  if (!applicationId || !title || !["general","status","interview","resume_request","next_step"].includes(updateType)) return;

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("candidate_id,job_id")
    .eq("id", applicationId)
    .single();

  if (appError) throw appError;

  const { data: update, error } = await supabase
    .from("candidate_portal_updates")
    .insert({
      application_id: applicationId,
      recruiter_id: recruiter.id,
      update_type: updateType,
      title,
      body,
      visible: true
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "candidate_portal_update_published",
    details: { update_id: update.id, update_type: updateType, title }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
}

export async function hideCandidatePortalUpdate(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const updateId = clean(formData.get("update_id"));
  if (!updateId) return;

  const { data: update, error: fetchError } = await supabase
    .from("candidate_portal_updates")
    .select("id,application_id,application:applications(candidate_id,job_id)")
    .eq("id", updateId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("candidate_portal_updates")
    .update({ visible: false })
    .eq("id", updateId);

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: update.application.candidate_id,
    application_id: update.application_id,
    actor_id: recruiter.id,
    activity_type: "candidate_portal_update_hidden",
    details: { update_id: updateId }
  });

  revalidatePath(`/admin/candidates/${update.application.candidate_id}`);
}


export async function mergeCandidateRecords(formData) {
  const { supabase } = await requireRecruiter();
  const primaryCandidateId = clean(formData.get("primary_candidate_id"));
  const duplicateCandidateId = clean(formData.get("duplicate_candidate_id"));

  if (!primaryCandidateId || !duplicateCandidateId || primaryCandidateId === duplicateCandidateId) return;

  const { data, error } = await supabase.rpc("merge_candidates", {
    primary_candidate_id: primaryCandidateId,
    duplicate_candidate_id: duplicateCandidateId
  });

  if (error) {
    redirect(`/admin/duplicates?merge_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/candidates");
  revalidatePath("/admin/duplicates");
  revalidatePath(`/admin/candidates/${data}`);
  redirect(`/admin/candidates/${data}?merged=1`);
}


export async function updateCandidateOwner(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const ownerId = clean(formData.get("owner_id"));
  if (!candidateId || !ownerId) return;

  const { data: owner, error: ownerError } = await supabase
    .from("recruiters")
    .select("id,organization_id,active,name")
    .eq("id", ownerId)
    .eq("organization_id", recruiter.organization_id)
    .eq("active", true)
    .single();

  if (ownerError || !owner) throw ownerError || new Error("Invalid recruiter owner");

  const { error } = await supabase
    .from("candidates")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .eq("organization_id", recruiter.organization_id);

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: candidateId,
    actor_id: recruiter.id,
    activity_type: "candidate_owner_changed",
    details: { owner_id: ownerId, owner_name: owner.name }
  });

  revalidatePath("/admin/candidates");
  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function updateJobOwner(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  const ownerId = clean(formData.get("owner_id"));
  if (!jobId || !ownerId) return;

  const { data: owner, error: ownerError } = await supabase
    .from("recruiters")
    .select("id,organization_id,active,name")
    .eq("id", ownerId)
    .eq("organization_id", recruiter.organization_id)
    .eq("active", true)
    .single();

  if (ownerError || !owner) throw ownerError || new Error("Invalid recruiter owner");

  const { error } = await supabase
    .from("jobs")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("organization_id", recruiter.organization_id);

  if (error) throw error;

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/dashboard");
}


export async function saveRoleEditor(formData) {
  const { recruiter, supabase } = await requireRecruiter();
  const jobId = clean(formData.get("job_id"));
  const intent = clean(formData.get("intent")) || "save";
  const title = clean(formData.get("title"));
  const ownerId = clean(formData.get("owner_id")) || recruiter.id;

  if (!jobId || !title) return;

  const { data: owner, error: ownerError } = await supabase
    .from("recruiters")
    .select("id")
    .eq("id", ownerId)
    .eq("organization_id", recruiter.organization_id)
    .eq("active", true)
    .single();

  if (ownerError || !owner) throw ownerError || new Error("Invalid role owner");

  const interviewStages = String(formData.get("interview_stages") || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const publicPayload = {
    title: clean(formData.get("public_title")) || title,
    department: clean(formData.get("public_department")),
    location: clean(formData.get("location")),
    workplace: clean(formData.get("workplace")),
    employment_type: clean(formData.get("employment_type")),
    compensation: clean(formData.get("compensation")),
    short_summary: clean(formData.get("short_summary")),
    description: clean(formData.get("description")),
    responsibilities: clean(formData.get("responsibilities")),
    requirements: clean(formData.get("requirements")),
    updated_at: new Date().toISOString()
  };

  const now = new Date().toISOString();

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      owner_id: ownerId,
      title,
      department: clean(formData.get("department")),
      client_name: clean(formData.get("client_name")),
      hiring_manager: clean(formData.get("hiring_manager")),
      client_contact: clean(formData.get("client_contact")),
      interview_stages: interviewStages,
      internal_notes: clean(formData.get("internal_notes")),
      updated_at: now
    })
    .eq("id", jobId)
    .eq("organization_id", recruiter.organization_id);

  if (jobError) throw jobError;

  const { error: postError } = await supabase
    .from("job_posts")
    .update(publicPayload)
    .eq("job_id", jobId);

  if (postError) throw postError;

  if (intent === "publish") {
    const missing = [];
    if (!publicPayload.title) missing.push("Public title");
    if (!publicPayload.location) missing.push("Location");
    if (!publicPayload.short_summary) missing.push("Short summary");
    if (!publicPayload.description) missing.push("About the role");

    if (missing.length) {
      redirect(`/admin/jobs/${jobId}?publish_error=${encodeURIComponent("Complete before publishing: " + missing.join(", "))}#role-editor`);
    }

    const [{ error: publishJobError }, { error: publishPostError }] = await Promise.all([
      supabase.from("jobs")
        .update({ status: "published", updated_at: now })
        .eq("id", jobId)
        .eq("organization_id", recruiter.organization_id),
      supabase.from("job_posts")
        .update({ published: true, published_at: now, updated_at: now })
        .eq("job_id", jobId)
    ]);

    if (publishJobError) throw publishJobError;
    if (publishPostError) throw publishPostError;

    revalidatePath("/");
    revalidatePath("/admin/jobs");
    revalidatePath(`/admin/jobs/${jobId}`);
    redirect(`/admin/jobs/${jobId}?saved=1&published=1#role-editor`);
  }

  revalidatePath("/");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/jobs/${jobId}?saved=1#role-editor`);
}
