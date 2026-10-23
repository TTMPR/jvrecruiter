import Link from "next/link";
import { logout } from "./login/actions";

export default function AdminShell({ recruiter, children }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div>
          <Link href="/admin/dashboard" className="admin-brand">JVRecruit</Link>
          <nav className="admin-nav">
            <Link href="/admin/dashboard">Dashboard</Link>
            <Link href="/admin/jobs">Jobs</Link>
            <Link href="/admin/candidates">Candidates</Link>
            <Link href="/admin/tasks">Tasks</Link>
          </nav>
        </div>

        <div className="sidebar-account">
          <strong>{recruiter.name}</strong>
          <span>{recruiter.email}</span>
          <form action={logout}>
            <button type="submit" className="text-button">Sign out</button>
          </form>
        </div>
      </aside>
      <section className="admin-content">{children}</section>
    </div>
  );
}
