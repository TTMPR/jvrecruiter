import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { addCandidate, processIntake } from "../actions";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];

export default async function CandidatesPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params?.q || "").trim().toLowerCase();
  const role = String(params?.role || "");
  const stage = String(params?.stage || "");
  const source = String(params?.source || "");
  const location = String(params?.location || "").trim().toLowerCase();
  const sort = String(params?.sort || "recent");

  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: candidates }, { data: intake }, { data: jobs }] = await Promise.all([
    supabase.from("candidates")
      .select("id, full_name, email, current_title, current_company, location, source, updated_at, applications(id, stage, job_id, job:jobs(id,title))")
      .order("updated_at", { ascending: sort !== "oldest" })
      .limit(500),
    supabase.from("public_intake")
      .select("id, submission_type, full_name, email, current_title, current_company, location, created_at, job_id")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("jobs")
      .select("id,title,status")
      .order("title", { ascending: true })
  ]);

  const sources = [...new Set((candidates || []).map((c) => c.source).filter(Boolean))].sort();

  const filtered = (candidates || []).filter((candidate) => {
    const haystack = [
      candidate.full_name,
      candidate.email,
      candidate.current_title,
      candidate.current_company,
      candidate.location
    ].filter(Boolean).join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
    if (source && candidate.source !== source) return false;
    if (location && !String(candidate.location || "").toLowerCase().includes(location)) return false;

    const applications = candidate.applications || [];
    if (role && !applications.some((app) => app.job_id === role)) return false;
    if (stage && !applications.some((app) => app.stage === stage)) return false;

    return true;
  });

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Talent network</h1>
          <p className="muted">{filtered.length} candidate{filtered.length === 1 ? "" : "s"} shown</p>
        </div>
      </header>

      <section className="panel">
        <h2>Search & filters</h2>
        <form method="get" className="filter-grid">
          <label>Search
            <input name="q" defaultValue={params?.q || ""} placeholder="Name, email, title, company..." />
          </label>
          <label>Role
            <select name="role" defaultValue={role}>
              <option value="">All roles</option>
              {(jobs || []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label>Stage
            <select name="stage" defaultValue={stage}>
              <option value="">All stages</option>
              {STAGES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Source
            <select name="source" defaultValue={source}>
              <option value="">All sources</option>
              {sources.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Location
            <input name="location" defaultValue={params?.location || ""} placeholder="Austin, Puerto Rico..." />
          </label>
          <label>Sort
            <select name="sort" defaultValue={sort}>
              <option value="recent">Recently updated</option>
              <option value="oldest">Oldest updated</option>
            </select>
          </label>
          <div className="filter-actions">
            <button type="submit">Apply filters</button>
            <Link className="secondary-button" href="/admin/candidates">Clear</Link>
          </div>
        </form>
      </section>

      <section className="panel top-gap">
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
        {!filtered.length ? (
          <div className="empty-state"><p>No candidates match these filters.</p></div>
        ) : (
          <div className="table-list">
            {filtered.map((candidate) => (
              <Link className="table-row candidate-directory-row" href={`/admin/candidates/${candidate.id}`} key={candidate.id}>
                <div>
                  <strong>{candidate.full_name}</strong>
                  <span>{[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") || candidate.email || "Candidate"}</span>
                  <span>
                    {(candidate.applications || []).slice(0, 3).map((app) => `${app.job?.title || "Role"} — ${app.stage}`).join(" · ")}
                  </span>
                </div>
                <div className="candidate-row-meta">
                  <span>{candidate.location || "No location"}</span>
                  <span>{candidate.source}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
