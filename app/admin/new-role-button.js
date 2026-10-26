"use client";

import { useEffect, useRef, useState } from "react";
import { createJob } from "./actions";

export default function NewRoleButton() {
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
        New role
      </button>

      <dialog
        ref={dialogRef}
        className="new-role-dialog"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <div className="new-role-dialog-header">
          <div>
            <p className="eyebrow">New search</p>
            <h2>Create role</h2>
            <p className="muted">Start with the basics. You can complete the JD on the next screen.</p>
          </div>
          <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <form action={createJob} className="stack-form new-role-form">
          <div className="form-grid">
            <label className="role-editor-wide">Internal role title
              <input name="title" required autoFocus />
            </label>
            <label>Department
              <input name="department" />
            </label>
            <label>Client
              <input name="client_name" />
            </label>
            <label>Hiring manager
              <input name="hiring_manager" />
            </label>
            <label>Client contact
              <input name="client_contact" />
            </label>
          </div>

          <label>Internal notes
            <textarea name="internal_notes" rows="3" />
          </label>

          <div className="new-role-dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit">Create role</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
