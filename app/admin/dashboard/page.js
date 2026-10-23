import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";

export default async function DashboardPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const [
    { count: activeJobs },
    { count: candidates },
    { count: interviews },
    { count: offers },
    { count: placements }
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).in("status", ["draft", "published", "paused"]),
    supabase.from("candidates").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "Interviewing"),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "Offer"),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("stage", "Placed")
  ]);

  const metrics = [
    ["Active roles", activeJobs || 0],
    ["Candidates", candidates || 0],
    ["Interviewing", interviews || 0],
    ["Offers", offers || 0],
    ["Placements", placements || 0]
  ];

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome, {recruiter.name.split(" ")[0]}.</h1>
        </div>
      </header>

      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <section className="panel">
        <h2>Recruiting workspace</h2>
        <p>
          Jobs, candidate master profiles and pipeline activity will populate here
          as JVRecruit starts receiving live data.
        </p>
      </section>
    </AdminShell>
  );
}
