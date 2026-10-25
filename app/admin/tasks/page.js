import Link from "next/link";
import { requireRecruiter } from "../../../lib/auth";
import AdminShell from "../admin-shell";
import { createTask, updateTaskStatus } from "../actions";
import { gmailComposeUrl } from "../communication-links";

const TYPES = [
  ["follow_up_candidate","Follow up candidate"],
  ["follow_up_client","Follow up client"],
  ["schedule_interview","Schedule interview"],
  ["send_submission","Send submission"],
  ["check_feedback","Check feedback"],
  ["other","Other"]
];

function puertoRicoDateKey(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function dueState(value, status) {
  if (status === "done" || !value) return "";
  const dueKey = puertoRicoDateKey(value);
  const todayKey = puertoRicoDateKey(new Date());
  if (!dueKey || !todayKey) return "";
  if (dueKey < todayKey) return "overdue";
  if (dueKey === todayKey) return "today";
  return "";
}

export default async function TasksPage({ searchParams }) {
  const params = await searchParams;
  const filter = String(params?.filter || "open");
  const { recruiter, supabase } = await requireRecruiter();

  const [{ data: tasks }, { data: candidates }, { data: jobs }, { data: teamRecruiters }] = await Promise.all([
    supabase.from("tasks")
      .select("id,title,notes,task_type,priority,status,due_at,created_at,owner:recruiters(id,name),candidate:candidates(id,full_name,email),job:jobs(id,title)")
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("candidates").select("id,full_name").order("full_name"),
    supabase.from("jobs").select("id,title,status").in("status", ["draft","published","paused"]).order("title"),
    supabase.from("recruiters")
      .select("id,name,email,role")
      .eq("organization_id", recruiter.organization_id)
      .eq("active", true)
      .order("name")
  ]);

  const filtered = (tasks || []).filter((task) => {
    const state = dueState(task.due_at, task.status);
    if (filter === "all") return true;
    if (filter === "done") return task.status === "done";
    if (filter === "overdue") return state === "overdue";
    if (filter === "today") return state === "today";
    return task.status === "open";
  });

  return (
    <AdminShell recruiter={recruiter}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Follow-ups</h1>
          <p className="muted">Keep candidate and client follow-ups from falling through the cracks.</p>
        </div>
      </header>

      <section className="panel">
        <h2>Create task</h2>
        <form action={createTask} className="task-create-form">
          <label>Task type
            <select name="task_type" defaultValue="follow_up_candidate">
              {TYPES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Title<input name="title" required placeholder="Follow up with candidate" /></label>
          <label>Priority
            <select name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>Due
            <input name="due_at" type="datetime-local" />
          </label>
          <label>Candidate
            <select name="candidate_id" defaultValue="">
              <option value="">None</option>
              {(candidates || []).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
            </select>
          </label>
          <label>Role
            <select name="job_id" defaultValue="">
              <option value="">None</option>
              {(jobs || []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label>Owner
            <select name="owner_id" defaultValue={recruiter.id}>
              {(teamRecruiters || []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label className="task-notes-field">Notes<textarea name="notes" rows="2" /></label>
          <button type="submit">Create task</button>
        </form>
      </section>

      <section className="panel top-gap">
        <div className="section-heading">
          <div>
            <h2>Task list</h2>
            <p className="muted">{filtered.length} task{filtered.length === 1 ? "" : "s"}</p>
          </div>
          <nav className="task-filters">
            <Link className={filter === "open" ? "active" : ""} href="/admin/tasks?filter=open">Open</Link>
            <Link className={filter === "today" ? "active" : ""} href="/admin/tasks?filter=today">Due today</Link>
            <Link className={filter === "overdue" ? "active" : ""} href="/admin/tasks?filter=overdue">Overdue</Link>
            <Link className={filter === "done" ? "active" : ""} href="/admin/tasks?filter=done">Done</Link>
            <Link className={filter === "all" ? "active" : ""} href="/admin/tasks?filter=all">All</Link>
          </nav>
        </div>

        <div className="task-list">
          {filtered.map((task) => {
            const state = dueState(task.due_at, task.status);
            return (
              <article className="task-row" key={task.id}>
                <div className="task-main">
                  <div className="task-title-line">
                    <strong>{task.title}</strong>
                    <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                    {state ? <span className={`due-pill ${state}`}>{state === "today" ? "Due today" : "Overdue"}</span> : null}
                  </div>
                  <span>{task.task_type.replaceAll("_", " ")}</span>
                  <span>
                    {[
                      task.owner?.name ? `Owner: ${task.owner.name}` : null,
                      task.candidate?.full_name,
                      task.job?.title,
                      task.due_at ? new Date(task.due_at).toLocaleString("en-US", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }) : null
                    ].filter(Boolean).join(" · ")}
                  </span>
                  {task.notes ? <p>{task.notes}</p> : null}
                </div>

                <div className="task-actions">
                  {task.candidate?.id ? <Link href={`/admin/candidates/${task.candidate.id}`}>Candidate</Link> : null}
                  {task.candidate?.email ? (
                    <a
                      href={gmailComposeUrl({
                        to: task.candidate.email,
                        subject: task.title,
                        body: `Hi ${task.candidate.full_name},\n\n`
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Email
                    </a>
                  ) : null}
                  {task.job?.id ? <Link href={`/admin/jobs/${task.job.id}`}>Role</Link> : null}
                  <form action={updateTaskStatus}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <input type="hidden" name="status" value={task.status === "done" ? "open" : "done"} />
                    <button type="submit">{task.status === "done" ? "Reopen" : "Done"}</button>
                  </form>
                </div>
              </article>
            );
          })}
          {!filtered.length ? <p className="muted">No tasks in this view.</p> : null}
        </div>
      </section>
    </AdminShell>
  );
}
