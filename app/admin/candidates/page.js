import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { addCandidate, processIntake } from "../actions";

const STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer","Placed","Rejected","Withdrawn","Archived"];

export default async function CandidatesPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params?.q || "").trim();
  const role = String(params?.role || "");
  const stage = String(params?.stage || "");
  const source = String(params?.source || "");
  const location = String(params?.location || "").trim();
  const sort = String(params?.sort || "recent");
  const page = Math.max(1, Number(params?.page || 1) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: candidates, error: candidateError }, { data: intake }, { data: jobs }] = await Promise.all([
    supabase.rpc("search_candidates_paginated", {
      search_query: q || null,
      role_filter: role || null,
      stage_filter: stage || null,
      source_filter: source || null,
      location_filter: location || null,
      sort_order: sort,
      page_offset: offset,
      page_limit: pageSize
    }),
    supabase.from("public_intake")
      .select("id, submission_type, full_name, email, current_title, current_company, location, created_at, job_id")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("jobs")
      .select("id,title,status")
      .order("title", { ascending: true })
  ]);

  if (candidateError) throw candidateError;

  const total = Number(candidates?.[0]?.total_count || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = candidates || [];
  const sources = [
    ["recruiter","Recruiter"],
    ["sourced","Sourced"],
    ["linkedin","LinkedIn"],
    ["referral","Referral"],
    ["network","Network"],
    ["website_application","Website application"],
    ["website_network","Website network"],
    ["applied","Applied"],
    ["other","Other"]
  ];

  function pageHref(nextPage) {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (role) query.set("role", role);
    if (stage) query.set("stage", stage);
    if (source) query.set("source", source);
    if (params?.location) query.set("location", params.location);
    if (sort && sort !== "recent") query.set("sort", sort);
    query.set("page", String(nextPage));
    return `/admin/candidates?${query.toString()}`;
  }

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Talent network</h1>
          <p className="muted">{total} candidate{total === 1 ? "" : "s"} · page {page} of {totalPages}</p>
        </div>
        <Link className="secondary-button" href="/admin/duplicates">Review duplicates</Link>
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
              {sources.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
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
          <nav className="pagination" aria-label="Candidate pages">
            <span>{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} of ${total}` : "0 candidates"}</span>
            <div>
              {page > 1 ? <Link className="secondary-button" href={pageHref(page - 1)}>← Previous</Link> : null}
              {page < totalPages ? <Link className="secondary-button" href={pageHref(page + 1)}>Next →</Link> : null}
            </div>
          </nav>
          </>
        )}
      </section>

      <section className="panel top-gap">
        <h2>Candidate directory</h2>
        {!filtered.length ? (
          <div className="empty-state"><p>No candidates match these filters.</p></div>
        ) : (
          <>
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
