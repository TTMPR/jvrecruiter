import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";

const PERIODS = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["all", "All time"]
];

function daysBetween(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 86400000;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatDays(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1) return "<1d";
  return `${value.toFixed(1)}d`;
}

function percent(numerator, denominator) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function money(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}

export default async function ReportsPage({ searchParams }) {
  const params = await searchParams;
  const selectedPeriod = ["7","30","90","all"].includes(String(params?.period))
    ? String(params.period)
    : "30";

  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: applications }, { data: jobs }, { data: placements }] = await Promise.all([
    supabase.from("applications")
      .select(`
        id,applied_at,stage,source,
        candidate:candidates(id,full_name),
        job:jobs(id,title,client_name,created_at),
        submission:candidate_submissions(id,status,submitted_at),
        interviews(id,scheduled_at,created_at,status),
        offers(id,status,extended_at,responded_at,created_at),
        placement:placements(id,created_at,start_date,estimated_fee,final_fee,invoice_status)
      `)
      .order("applied_at", { ascending:false }),
    supabase.from("jobs")
      .select("id,title,client_name,status,created_at")
      .order("created_at", { ascending:false }),
    supabase.from("placements")
      .select("id,created_at,start_date,estimated_fee,final_fee,invoice_status,application:applications(id,job:jobs(id,title,created_at),candidate:candidates(id,full_name))")
      .order("created_at", { ascending:false })
  ]);

  const now = Date.now();
  const cutoff = selectedPeriod === "all"
    ? null
    : now - Number(selectedPeriod) * 86400000;

  const cohort = (applications || []).filter((app) =>
    !cutoff || new Date(app.applied_at).getTime() >= cutoff
  );

  const submitted = cohort.filter((app) => app.submission?.submitted_at);
  const interviewed = cohort.filter((app) =>
    (app.interviews || []).some((interview) => interview.scheduled_at || interview.created_at)
  );
  const offered = cohort.filter((app) =>
    (app.offers || []).some((offer) => ["extended","accepted","declined"].includes(offer.status))
  );
  const placed = cohort.filter((app) => app.placement);

  const avgTimeToSubmit = average(
    submitted.map((app) => daysBetween(app.applied_at, app.submission.submitted_at))
  );

  const avgTimeToInterview = average(
    interviewed.map((app) => {
      const first = (app.interviews || [])
        .map((interview) => interview.scheduled_at || interview.created_at)
        .filter(Boolean)
        .sort()[0];
      return daysBetween(app.applied_at, first);
    })
  );

  const periodPlacements = (placements || []).filter((placement) =>
    !cutoff || new Date(placement.created_at).getTime() >= cutoff
  );

  const avgTimeToFill = average(
    periodPlacements.map((placement) =>
      daysBetween(
        placement.application?.job?.created_at,
        placement.created_at
      )
    )
  );

  const finalFees = periodPlacements.reduce((sum, placement) => sum + Number(placement.final_fee || 0), 0);
  const estimatedOnly = periodPlacements.reduce((sum, placement) => {
    if (placement.final_fee) return sum;
    return sum + Number(placement.estimated_fee || 0);
  }, 0);

  const funnel = [
    ["Applications", cohort.length, "100%"],
    ["Submitted", submitted.length, percent(submitted.length, cohort.length)],
    ["Interviewed", interviewed.length, percent(interviewed.length, submitted.length || cohort.length)],
    ["Offered", offered.length, percent(offered.length, interviewed.length)],
    ["Placed", placed.length, percent(placed.length, offered.length)]
  ];

  const sourceCounts = {};
  for (const app of cohort) {
    const source = app.source || "unknown";
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }
  const sourceRows = Object.entries(sourceCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0,8);

  const roleRows = (jobs || []).map((job) => {
    const apps = cohort.filter((app) => app.job?.id === job.id);
    const subs = apps.filter((app) => app.submission?.submitted_at);
    const ints = apps.filter((app) => (app.interviews || []).length);
    const offs = apps.filter((app) => (app.offers || []).some((offer) => ["extended","accepted","declined"].includes(offer.status)));
    const pls = apps.filter((app) => app.placement);
    const fees = pls.reduce((sum, app) => sum + Number(app.placement?.final_fee || app.placement?.estimated_fee || 0), 0);

    return {
      ...job,
      applications: apps.length,
      submitted: subs.length,
      interviewed: ints.length,
      offered: offs.length,
      placed: pls.length,
      fees
    };
  })
    .filter((row) => row.applications || row.placed)
    .sort((a,b) => b.placed - a.placed || b.submitted - a.submitted || b.applications - a.applications);

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1>Recruiter analytics</h1>
          <p className="muted">Conversion, speed and placement performance across your searches.</p>
        </div>

        <nav className="report-periods">
          {PERIODS.map(([value,label]) => (
            <Link
              className={selectedPeriod === value ? "active" : ""}
              href={`/admin/reports?period=${value}`}
              key={value}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="report-kpi-grid">
        <article><span>Applications</span><strong>{cohort.length}</strong></article>
        <article><span>Submissions</span><strong>{submitted.length}</strong></article>
        <article><span>Interviews</span><strong>{interviewed.length}</strong></article>
        <article><span>Offers</span><strong>{offered.length}</strong></article>
        <article><span>Placements</span><strong>{placed.length}</strong></article>
        <article><span>Fees</span><strong>{finalFees ? money(finalFees) : estimatedOnly ? `Est. ${money(estimatedOnly)}` : "$0"}</strong></article>
      </div>

      <div className="report-kpi-grid speed-grid">
        <article><span>Avg. time to submit</span><strong>{formatDays(avgTimeToSubmit)}</strong></article>
        <article><span>Avg. time to interview</span><strong>{formatDays(avgTimeToInterview)}</strong></article>
        <article><span>Avg. time to fill</span><strong>{formatDays(avgTimeToFill)}</strong></article>
        <article><span>Submit → Interview</span><strong>{percent(interviewed.length, submitted.length)}</strong></article>
        <article><span>Interview → Offer</span><strong>{percent(offered.length, interviewed.length)}</strong></article>
        <article><span>Offer → Placement</span><strong>{percent(placed.length, offered.length)}</strong></article>
      </div>

      <div className="reports-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Conversion</p>
              <h2>Funnel</h2>
            </div>
          </div>

          <div className="funnel-list">
            {funnel.map(([label,count,rate], index) => (
              <div className="funnel-row" key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>{rate}</span>
                </div>
                <div className="funnel-bar-wrap">
                  <div
                    className="funnel-bar"
                    style={{ width: `${cohort.length ? Math.max(4, (Number(count) / cohort.length) * 100) : 0}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sources</p>
              <h2>Application sources</h2>
            </div>
          </div>

          <div className="source-list">
            {sourceRows.map(([source,count]) => (
              <div key={source}>
                <span>{source.replaceAll("_"," ")}</span>
                <strong>{count}</strong>
              </div>
            ))}
            {!sourceRows.length ? <p className="muted">No source data in this period.</p> : null}
          </div>
        </section>
      </div>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search performance</p>
            <h2>By role</h2>
          </div>
        </div>

        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Apps</th>
                <th>Subs</th>
                <th>Interviews</th>
                <th>Offers</th>
                <th>Placed</th>
                <th>Submit rate</th>
                <th>Fees</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/jobs/${row.id}`}>
                      <strong>{row.title}</strong>
                      <span>{row.client_name || "Confidential client"}</span>
                    </Link>
                  </td>
                  <td>{row.applications}</td>
                  <td>{row.submitted}</td>
                  <td>{row.interviewed}</td>
                  <td>{row.offered}</td>
                  <td>{row.placed}</td>
                  <td>{percent(row.submitted, row.applications)}</td>
                  <td>{row.fees ? money(row.fees) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!roleRows.length ? <p className="muted">No role activity in this period yet.</p> : null}
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Placements</p>
            <h2>Recent revenue</h2>
          </div>
        </div>

        <div className="table-list">
          {periodPlacements.slice(0,10).map((placement) => (
            <Link
              className="table-row"
              href={placement.application?.candidate?.id ? `/admin/candidates/${placement.application.candidate.id}` : "/admin/candidates"}
              key={placement.id}
            >
              <div>
                <strong>{placement.application?.candidate?.full_name || "Candidate"}</strong>
                <span>{placement.application?.job?.title || "Role"} · {placement.start_date ? `Starts ${placement.start_date}` : "Start pending"}</span>
              </div>
              <div className="report-placement-meta">
                <span className={`invoice-pill ${placement.invoice_status}`}>{placement.invoice_status.replaceAll("_"," ")}</span>
                <strong>{placement.final_fee ? money(placement.final_fee) : placement.estimated_fee ? `Est. ${money(placement.estimated_fee)}` : "Fee pending"}</strong>
              </div>
            </Link>
          ))}
          {!periodPlacements.length ? <p className="muted">No placements in this period.</p> : null}
        </div>
      </section>
    </AdminShell>
  );
}
