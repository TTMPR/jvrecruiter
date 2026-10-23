import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { addCandidate, processIntake } from "../actions";

export default async function CandidatesPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: candidates }, { data: intake }] = await Promise.all([
    supabase.from("candidates")
      .select("id, full_name, email, current_title, current_company, location, source, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("public_intake")
      .select("id, submission_type, full_name, email, current_title, current_company, location, created_at, job_id")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Talent network</h1>
        </div>
      </header>

      <section className="panel">
        <h2>Add candidate</h2>
        <form action={addCandidate} className="stack-form">
          <div className="form-grid">
            <label>Full name<input name="full_name" required /></label>
            <label>Email<input name="email" type="email" /></label>
            <label>Phone<input name="phone" /></label>
            <label>Location<input name="location" /></label>
            <label>Current title<input name="current_title" /></label>
            <label>Current company<input name="current_company" /></label>
            <label>LinkedIn<input name="linkedin_url" type="url" /></label>
            <label>Source<input name="source" defaultValue="recruiter" /></label>
          </div>
          <button type="submit">Add candidate</button>
        </form>
      </section>

      <section className="panel top-gap">
        <h2>Website intake {intake?.length ? `(${intake.length})` : ""}</h2>
        {!intake?.length ? <p className="muted">No new website submissions.</p> : (
          <div className="table-list">
            {intake.map((item) => (
              <div className="table-row" key={item.id}>
                <div>
                  <strong>{item.full_name}</strong>
                  <span>{item.submission_type} · {[item.current_title, item.current_company, item.location].filter(Boolean).join(" · ")}</span>
                  <span>{item.email}</span>
                </div>
                <form action={processIntake}>
                  <input type="hidden" name="intake_id" value={item.id} />
                  <button type="submit">Process</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel top-gap">
        <h2>Candidate directory</h2>
        {!candidates?.length ? (
          <div className="empty-state"><p>No candidates yet.</p></div>
        ) : (
          <div className="table-list">
            {candidates.map((candidate) => (
              <Link className="table-row" href={`/admin/candidates/${candidate.id}`} key={candidate.id}>
                <div>
                  <strong>{candidate.full_name}</strong>
                  <span>{[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") || candidate.email || "Candidate"}</span>
                </div>
                <span>{candidate.location || candidate.source}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
