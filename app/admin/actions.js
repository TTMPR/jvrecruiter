"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRecruiter } from "../../lib/auth";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];

function clean(value) {
  const v = String(value || "").trim();
  return v || null;
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
      created_by: recruiter.id
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/admin/candidates");
  redirect(`/admin/candidates/${candidate.id}`);
}

export async function processIntake(formData) {
  const { supabase } = await requireRecruiter();
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
      latest_resume_path: intake.resume_path,
      latest_resume_name: intake.resume_name,
      latest_resume_mime_type: intake.resume_mime_type,
      latest_resume_uploaded_at: intake.resume_path ? new Date().toISOString() : null
    }).select("id").single();
    if (insertError) throw insertError;
    candidate = data;
  } else {
    await supabase.from("candidates").update({
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
  }

  let applicationId = null;
  if (intake.submission_type === "application" && intake.job_id) {
    const { data: application, error: appError } = await supabase.from("applications")
      .upsert({
        candidate_id: candidate.id,
        job_id: intake.job_id,
        stage: "Applied",
        source: "website",
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

  await supabase.from("public_intake").update({
    status: "processed",
    processed_at: new Date().toISOString()
  }).eq("id", intake.id);

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

  await supabase.from("applications").update({
    stage,
    interview_stage: stage === "Interviewing" ? interviewStage : null,
    updated_at: new Date().toISOString()
  }).eq("id", applicationId);

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
  const { supabase } = await requireRecruiter();
  const candidateId = clean(formData.get("candidate_id"));
  const jobId = clean(formData.get("job_id"));
  if (!candidateId || !jobId) return;

  await supabase.from("applications").upsert({
    candidate_id: candidateId,
    job_id: jobId,
    stage: "Applied",
    source: "recruiter",
    updated_at: new Date().toISOString()
  }, { onConflict: "candidate_id,job_id" });

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
  if (!jobId) return;

  const { error } = await supabase.from("job_posts").update({
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
  }).eq("job_id", jobId);

  if (error) throw error;

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
      redirect(`/admin/jobs/${jobId}?publish_error=${encodeURIComponent("Complete before publishing: " + missing.join(", "))}`);
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
  if (!applicationId || !stageName) return;

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
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status: "scheduled",
      notes: clean(formData.get("notes")),
      created_by: recruiter.id
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.from("applications").update({
    stage: "Interviewing",
    interview_stage: stageName,
    updated_at: new Date().toISOString()
  }).eq("id", applicationId);

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: applicationId,
    actor_id: recruiter.id,
    activity_type: "interview_scheduled",
    details: {
      interview_id: interview.id,
      stage_name: stageName,
      scheduled_at: scheduledAt || null
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
  if (!interviewId || !stageName || !["scheduled","completed","cancelled","no_show"].includes(status)) return;

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
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    status,
    notes: clean(formData.get("notes")),
    updated_at: new Date().toISOString()
  }).eq("id", interviewId);

  if (error) throw error;

  if (status !== "cancelled") {
    await supabase.from("applications").update({
      stage: "Interviewing",
      interview_stage: stageName,
      updated_at: new Date().toISOString()
    }).eq("id", interview.application_id);
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
      scheduled_at: scheduledAt || null
    }
  });

  revalidatePath(`/admin/candidates/${application.candidate_id}`);
  revalidatePath(`/admin/jobs/${application.job_id}`);
}
