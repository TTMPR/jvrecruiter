"use client";

import { useEffect, useRef, useState } from "react";
import { addCandidate } from "./actions";

export default function AddCandidateButton() {
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
        Candidate
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
            <h2>New candidate</h2>
            <p className="muted">Add a candidate manually to the talent network.</p>
          </div>
          <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <form action={addCandidate} className="stack-form new-role-form">
          <div className="form-grid">
            <label>Full name<input name="full_name" required autoFocus /></label>
            <label>Email<input name="email" type="email" /></label>
            <label>Phone<input name="phone" /></label>
            <label>Location<input name="location" /></label>
            <label>Current title<input name="current_title" /></label>
            <label>Current company<input name="current_company" /></label>
            <label className="role-editor-wide">LinkedIn<input name="linkedin_url" type="url" /></label>
            <label>Source
              <select name="source" defaultValue="recruiter">
                <option value="recruiter">Recruiter</option>
                <option value="sourced">Sourced</option>
                <option value="linkedin">LinkedIn</option>
                <option value="referral">Referral</option>
                <option value="network">Network</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="new-role-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit">Add candidate</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
