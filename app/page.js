import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import PublicIntakeForm from "./public-intake-form";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("job_posts")
    .select("job_id, slug, title, department, location, workplace, short_summary, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false });

  return (
    <main className="public-shell">
      <header className="public-nav">
        <strong>JVRecruit</strong>
        <nav>
          <a href="#roles">Open Roles</a>
          <a href="#network">Join My Network</a>
          <Link href="/admin/login">Admin</Link>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Confidential search</p>
        <h1>Find your next opportunity without the noise.</h1>
        <p className="lede">
          Curated technical, product, data and leadership opportunities with a thoughtful recruiting experience.
        </p>
        <p className="affiliation">Current searches managed through Towerhill Associates.</p>
      </section>

      <section id="roles" className="public-section">
        <p className="eyebrow">Open roles</p>
        <h2>Current opportunities.</h2>
        <div className="role-list">
          {(roles || []).map((role) => (
            <Link className="role-row" href={`/jobs/${role.slug}`} key={role.job_id}>
              <div>
                <strong>{role.title}</strong>
                <span>{[role.department, role.location, role.workplace].filter(Boolean).join(" · ")}</span>
                {role.short_summary ? <p>{role.short_summary}</p> : null}
              </div>
              <span>View role →</span>
            </Link>
          ))}
          {!roles?.length ? <p className="muted">No roles are published right now.</p> : null}
        </div>
      </section>

      <section id="network" className="public-section">
        <p className="eyebrow">Join my network</p>
        <h2>Not seeing the right role?</h2>
        <p className="lede">
          Share your background and I can keep your profile available for future searches without applying to a specific position.
        </p>
        <PublicIntakeForm type="network" />
      </section>
    </main>
  );
}
