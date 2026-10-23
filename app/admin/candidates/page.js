import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";

export default async function CandidatesPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, email, current_title, current_company, location, source, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Talent network</h1>
        </div>
        <button className="primary-button">Add candidate</button>
      </header>

      <section className="panel">
        {!candidates?.length ? (
          <div className="empty-state">
            <h2>No candidates yet.</h2>
            <p>Applications and Join My Network profiles will appear here.</p>
          </div>
        ) : (
          <div className="table-list">
            {candidates.map((candidate) => (
              <div className="table-row" key={candidate.id}>
                <div>
                  <strong>{candidate.full_name}</strong>
                  <span>
                    {[candidate.current_title, candidate.current_company]
                      .filter(Boolean)
                      .join(" · ") || candidate.email || "Candidate"}
                  </span>
                </div>
                <span>{candidate.location || candidate.source}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
