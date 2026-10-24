import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { mergeCandidateRecords } from "../actions";

function profileLine(candidate) {
  return [
    candidate.title,
    candidate.company,
    candidate.location
  ].filter(Boolean).join(" · ");
}

export default async function DuplicateCandidatesPage({ searchParams }) {
  const params = await searchParams;
  const mergeError = params?.merge_error;
  const { recruiter, supabase } = await requireRecruiter();

  const { data: pairs, error } = await supabase
    .from("candidate_duplicate_pairs")
    .select("*")
    .order("match_score", { ascending: false })
    .order("candidate_a_updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Data quality</p>
          <h1>Potential duplicates</h1>
          <p className="muted">Review likely duplicate candidate records before merging.</p>
        </div>
        <Link className="secondary-button" href="/admin/candidates">Back to candidates</Link>
      </header>

      {mergeError ? <div className="error-box top-gap">{mergeError}</div> : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Duplicate review</h2>
            <p className="muted">
              Matches are suggested from phone, name + company, and name + location. Merge only when you are sure both records are the same person.
            </p>
          </div>
          <span className="status-pill">{pairs?.length || 0} match{pairs?.length === 1 ? "" : "es"}</span>
        </div>

        {!pairs?.length ? (
          <div className="empty-state duplicate-empty">
            <strong>No likely duplicates right now.</strong>
            <p>JVRecruit will surface candidates here as the database grows.</p>
          </div>
        ) : (
          <div className="duplicate-list">
            {pairs.map((pair) => {
              const a = {
                id: pair.candidate_a_id,
                name: pair.candidate_a_name,
                email: pair.candidate_a_email,
                phone: pair.candidate_a_phone,
                linkedin: pair.candidate_a_linkedin,
                title: pair.candidate_a_title,
                company: pair.candidate_a_company,
                location: pair.candidate_a_location
              };

              const b = {
                id: pair.candidate_b_id,
                name: pair.candidate_b_name,
                email: pair.candidate_b_email,
                phone: pair.candidate_b_phone,
                linkedin: pair.candidate_b_linkedin,
                title: pair.candidate_b_title,
                company: pair.candidate_b_company,
                location: pair.candidate_b_location
              };

              return (
                <article className="duplicate-card" key={`${a.id}-${b.id}`}>
                  <div className="duplicate-card-header">
                    <div>
                      <span className="duplicate-score">Match score {pair.match_score}</span>
                      <strong>{pair.match_reasons}</strong>
                    </div>
                    {pair.has_role_overlap ? <span className="danger-pill">Needs review</span> : <span className="success-pill">Safe to merge</span>}
                  </div>

                  <div className="duplicate-compare-grid">
                    {[a,b].map((candidate,index) => (
                      <section key={candidate.id} className="duplicate-profile">
                        <div>
                          <span>Candidate {index === 0 ? "A" : "B"}</span>
                          <Link href={`/admin/candidates/${candidate.id}`}><strong>{candidate.name}</strong></Link>
                          <p>{profileLine(candidate) || "No current role details"}</p>
                        </div>
                        <dl>
                          <div><dt>Email</dt><dd>{candidate.email || "—"}</dd></div>
                          <div><dt>Phone</dt><dd>{candidate.phone || "—"}</dd></div>
                          <div><dt>LinkedIn</dt><dd>{candidate.linkedin ? "Available" : "—"}</dd></div>
                        </dl>
                      </section>
                    ))}
                  </div>

                  {pair.has_role_overlap ? (
                    <div className="duplicate-warning">
                      These records share at least one role. Open both Candidate Masters and resolve the overlapping application before merging so interview/submission history is not lost.
                    </div>
                  ) : (
                    <div className="duplicate-actions">
                      <form action={mergeCandidateRecords}>
                        <input type="hidden" name="primary_candidate_id" value={a.id} />
                        <input type="hidden" name="duplicate_candidate_id" value={b.id} />
                        <button type="submit">Keep {a.name}</button>
                      </form>
                      <form action={mergeCandidateRecords}>
                        <input type="hidden" name="primary_candidate_id" value={b.id} />
                        <input type="hidden" name="duplicate_candidate_id" value={a.id} />
                        <button type="submit" className="secondary-button">Keep {b.name}</button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
