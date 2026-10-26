"use client";

import { useEffect, useRef, useState } from "react";
import { createTask } from "./actions";

const TYPES = [
  ["follow_up_candidate","Follow up candidate"],
  ["follow_up_client","Follow up client"],
  ["schedule_interview","Schedule interview"],
  ["send_submission","Send submission"],
  ["check_feedback","Check feedback"],
  ["other","Other"]
];

export default function AddTaskButton({ recruiterId, candidates = [], jobs = [], recruiters = [] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button type="button" className="new-role-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span>
        Task
      </button>

      <dialog
        ref={dialogRef}
        className="new-role-dialog"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <div className="new-role-dialog-header">
          <div>
            <p className="eyebrow">Add</p>
            <h2>New task</h2>
            <p className="muted">Create a follow-up and assign it to the right recruiter.</p>
          </div>
          <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <form action={createTask} className="stack-form new-role-form">
          <div className="form-grid">
            <label>Task type
              <select name="task_type" defaultValue="follow_up_candidate">
                {TYPES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Priority
              <select name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="role-editor-wide">Title
              <input name="title" required autoFocus placeholder="Follow up with candidate" />
            </label>
            <label>Due
              <input name="due_at" type="datetime-local" />
            </label>
            <label>Owner
              <select name="owner_id" defaultValue={recruiterId}>
                {recruiters.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>Candidate
              <select name="candidate_id" defaultValue="">
                <option value="">None</option>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
              </select>
            </label>
            <label>Role
              <select name="job_id" defaultValue="">
                <option value="">None</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </label>
            <label className="role-editor-wide">Notes
              <textarea name="notes" rows="3" />
            </label>
          </div>

          <div className="new-role-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit">Create task</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
