"use server";

import { revalidatePath } from "next/cache";
import { createPortalClient } from "../../../lib/supabase/portal";

function clean(value) {
  const v = String(value || "").trim();
  return v || null;
}

function safeStorageName(value) {
  return String(value || "resume")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "resume";
}

async function getApplication(supabase) {
  const { data, error } = await supabase
    .from("applications")
    .select("id,candidate_id,job_id,stage,resume_document_id")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Portal access is invalid or expired");
  return data;
}

export async function updatePortalProfile(formData) {
  const token = clean(formData.get("portal_token"));
  if (!token) return;

  const supabase = createPortalClient(token);
  const application = await getApplication(supabase);

  const { error } = await supabase
    .from("candidates")
    .update({
      email: clean(formData.get("email")),
      phone: clean(formData.get("phone")),
      linkedin_url: clean(formData.get("linkedin_url")),
      location: clean(formData.get("location")),
      current_title: clean(formData.get("current_title")),
      current_company: clean(formData.get("current_company")),
      updated_at: new Date().toISOString()
    })
    .eq("id", application.candidate_id);

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    actor_id: null,
    activity_type: "candidate_profile_updated",
    details: { source: "candidate_portal" }
  });

  revalidatePath(`/portal/${token}`);
}

export async function uploadPortalResume(formData) {
  const token = clean(formData.get("portal_token"));
  const file = formData.get("resume");
  if (!token || !file || typeof file !== "object" || !file.name || !file.size) return;

  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  if (file.size > 10 * 1024 * 1024) throw new Error("Résumé exceeds the 10 MB limit");
  if (!allowed.includes(file.type)) throw new Error("Résumé must be PDF, DOC or DOCX");

  const supabase = createPortalClient(token);
  const application = await getApplication(supabase);

  const path = `candidate-portal/${application.candidate_id}/${Date.now()}-${safeStorageName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: document, error: documentError } = await supabase
    .from("candidate_documents")
    .insert({
      candidate_id: application.candidate_id,
      recruiter_id: null,
      document_type: "resume",
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
      label: "Candidate portal résumé",
      notes: "Uploaded by candidate through portal",
      is_primary: false
    })
    .select("id")
    .single();

  if (documentError) throw documentError;

  const { error: actionError } = await supabase.from("candidate_portal_actions").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    action_type: "assign_resume",
    details: { document_id: document.id }
  });

  if (actionError) throw actionError;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    actor_id: null,
    activity_type: "candidate_resume_updated",
    details: { document_id: document.id, file_name: file.name, source: "candidate_portal" }
  });

  revalidatePath(`/portal/${token}`);
}

export async function withdrawPortalApplication(formData) {
  const token = clean(formData.get("portal_token"));
  if (!token) return;

  const supabase = createPortalClient(token);
  const application = await getApplication(supabase);

  const { error } = await supabase.from("candidate_portal_actions").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    action_type: "withdraw",
    details: {}
  });

  if (error) throw error;

  await supabase.from("activities").insert({
    candidate_id: application.candidate_id,
    application_id: application.id,
    actor_id: null,
    activity_type: "candidate_withdrew",
    details: { source: "candidate_portal" }
  });

  revalidatePath(`/portal/${token}`);
}
