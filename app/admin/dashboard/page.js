import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { updateTaskStatus } from "../actions";

const ACTIVE_STAGES = ["Applied","Prescreen","Submitted","Client Sub","Interviewing","Offer"];

function daysSince(value) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function activityLabel(type) {
  return String(type || "activity").replaceAll("_", " ");
}

export default async function DashboardPage() {
  const { recruiter, supabase } = await requireRecruiter();

  const [
    { data: jobs },
    { data: candidates },
    { data: applications },
    { data: interviews },
    { data: activities },
    { data: intake },
    { data: tasks }
  ] = await Promise.all([
    supabase.from("jobs")
      .select("id,title,status,client_name,updated_at")
      .in("status", ["draft","published","paused"])
      .order("updated_at", { ascending: false }),
    supabase.from("candidates")
      .select("id,full_name,created_at,updated_at")
      .order("created_at", { ascending: false }),
    supabase.from("applications")
      .select("id,stage,interview_stage,updated_at,candidate:candidates(id,full_name,current_title,current_company),job:jobs(id,title,status)")
      .order("updated_at", { ascending: true }),
    supabase.from("interviews")
      .select("id,stage_name,scheduled_at,status,application:applications(id,candidate:candidates(id,full_name),job:jobs(id,title))")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true }),
    supabase.from("activities")
      .select("id,activity_type,details,created_at,candidate:candidates(id,full_name)")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("public_intake")
      .select("id")
      .eq("status", "new"),
    supabase.from("tasks")
      .select("id,title,priority,status,due_at,candidate:candidates(id,full_name),job:jobs(id,title)")
      .eq("status", "open")
      .order("due_at", { ascending:true, nullsFirst:false })
      .limit(20)
  ]);

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  const candidatesThisWeek = (candidates || []).filter((candidate) => new Date(candidate.created_at).getTime() >= weekAgo).length;
  const interviewing = (applications || []).filter((app) => app.stage === "Interviewing").length;
  const offers = (applications || []).filter((app) => app.stage === "Offer").length;
  const placements = (applications || []).filter((app) => app.stage === "Placed").length;
  const upcoming = (interviews || []).filter((interview) => interview.scheduled_at && new Date(interview.scheduled_at).getTime() >= now).slice(0, 6);

  const aging = (applications || [])
    .filter((app) => ACTIVE_STAGES.includes(app.stage))
    .map((app) => ({ ...app, ageDays: daysSince(app.updated_at) }))
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);

  const roleRows = (jobs || []).map((job) => {
    const apps = (applications || []).filter((app) => app.job?.id === job.id);
    const lastApplication = apps
      .map((app) => app.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    const lastActivity = lastApplication || job.updated_at;
    const age = daysSince(lastActivity);
    return {
      ...job,
      candidateCount: apps.length,
      ageDays: age,
      needsAttention: age >= 7 || apps.length === 0
    };
  }).sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || b.ageDays - a.ageDays);

  const dateKey = (value) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));

  const todayKey = dateKey(new Date());
  const taskRows = (tasks || []).map((task) => ({
    ...task,
    dueKey: task.due_at ? dateKey(task.due_at) : null
  }));
  const dueToday = taskRows.filter((task) => task.dueKey === todayKey);
  const overdueTasks = taskRows.filter((task) => task.dueKey && task.dueKey < todayKey);
  const attentionTasks = [...overdueTasks, ...dueToday].slice(0, 8);

  const metrics = [
    ["Active roles", (jobs || []).length],
    ["New candidates · 7d", candidatesThisWeek],
    ["Interviewing", interviewing],
    ["Offers", offers],
    ["Placements", placements],
    ["Website intake", (intake || []).length],
    ["Due today", dueToday.length]
  ];

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome, {recruiter.name.split(" ")[0]}.</h1>
          <p className="muted">A live view of what needs attention across your searches.</p>
        </div>
      </header>

      <div className="metric-grid dashboard-metrics">
        {metrics.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attention</p>
              <h2>Roles needing a push</h2>
            </div>
            <Link className="secondary-button" href="/admin/jobs">All jobs</Link>
          </div>

          <div className="table-list">
            {roleRows.map((job) => (
              <Link className="table-row dashboard-role-row" href={`/admin/jobs/${job.id}`} key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <span>{job.client_name || "Confidential client"} · {job.candidateCount} candidate{job.candidateCount === 1 ? "" : "s"}</span>
                </div>
                <div className="dashboard-row-right">
                  {job.needsAttention ? <span className="attention-pill">Needs attention</span> : <span className="healthy-pill">Active</span>}
                  <span>{job.ageDays}d since activity</span>
                </div>
              </Link>
            ))}
            {!roleRows.length ? <p className="muted">No active roles yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2>Upcoming interviews</h2>
            </div>
          </div>

          <div className="dashboard-list">
            {upcoming.map((interview) => (
              <Link
                className="dashboard-item"
                href={interview.application?.candidate?.id ? `/admin/candidates/${interview.application.candidate.id}` : "/admin/candidates"}
                key={interview.id}
              >
                <div>
                  <strong>{interview.application?.candidate?.full_name || "Candidate"}</strong>
                  <span>{interview.application?.job?.title || "Role"} · {interview.stage_name}</span>
                </div>
                <time>{new Date(interview.scheduled_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" })}</time>
              </Link>
            ))}
            {!upcoming.length ? <p className="muted">No interviews scheduled.</p> : null}
          </div>
        </section>
      </div>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Follow-ups</p>
            <h2>Tasks needing attention</h2>
          </div>
          <Link className="secondary-button" href="/admin/tasks">All tasks</Link>
        </div>

        <div className="task-list dashboard-task-list">
          {attentionTasks.map((task) => (
            <article className="task-row" key={task.id}>
              <div className="task-main">
                <div className="task-title-line">
                  <strong>{task.title}</strong>
                  <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                  <span className={`due-pill ${task.dueKey < todayKey ? "overdue" : "today"}`}>
                    {task.dueKey < todayKey ? "Overdue" : "Due today"}
                  </span>
                </div>
                <span>{[task.candidate?.full_name, task.job?.title, task.due_at ? new Date(task.due_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }) : null].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="task-actions">
                <Link href={task.candidate?.id ? `/admin/candidates/${task.candidate.id}` : task.job?.id ? `/admin/jobs/${task.job.id}` : "/admin/tasks"}>Open</Link>
                <form action={updateTaskStatus}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit">Done</button>
                </form>
              </div>
            </article>
          ))}
          {!attentionTasks.length ? <p className="muted">Nothing overdue or due today.</p> : null}
        </div>
      </section>

      <div className="dashboard-grid top-gap">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pipeline aging</p>
              <h2>Stuck candidates</h2>
            </div>
          </div>

          <div className="table-list">
            {aging.map((app) => (
              <Link className="table-row" href={`/admin/candidates/${app.candidate?.id}`} key={app.id}>
                <div>
                  <strong>{app.candidate?.full_name || "Candidate"}</strong>
                  <span>{app.job?.title || "Role"} · {app.interview_stage || app.stage}</span>
                </div>
                <span className={app.ageDays >= 7 ? "aging-badge warn" : "aging-badge"}>{app.ageDays}d</span>
              </Link>
            ))}
            {!aging.length ? <p className="muted">No active candidates in pipeline yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h2>Recent activity</h2>
            </div>
          </div>

          <div className="activity-list dashboard-activity">
            {(activities || []).map((activity) => (
              <div className="activity-row" key={activity.id}>
                <div>
                  <strong>{activityLabel(activity.activity_type)}</strong>
                  <span>{activity.candidate?.full_name || "System"}</span>
                </div>
                <span>{new Date(activity.created_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            ))}
            {!activities?.length ? <p className="muted">Activity will appear here as you work candidates.</p> : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
