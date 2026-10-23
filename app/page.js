import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import PublicIntakeForm from "./public-intake-form";
import RichText from "./rich-text";

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
        </nav>
      </header>

      <section className="hero candidate-hero">
        <div className="hero-copy">
          <p className="eyebrow">Thoughtful recruiting, fewer distractions</p>
          <h1>Find your next opportunity without the noise.</h1>
          <p className="lede">
            Curated technical, product, data and leadership opportunities with a simple, direct recruiting experience.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#roles">Explore open roles</a>
            <a className="secondary-button" href="#network">Join talent network</a>
          </div>
          <p className="affiliation">Current searches managed through Towerhill Associates.</p>
        </div>

        <aside className="candidate-promise" aria-label="What candidates can expect">
          <span className="promise-number">01</span>
          <strong>Clear opportunities.</strong>
          <p>See the role, location and key details before you apply.</p>
          <span className="promise-number">02</span>
          <strong>Simple application.</strong>
          <p>No account creation and no long application portal.</p>
          <span className="promise-number">03</span>
          <strong>Human follow-up.</strong>
          <p>If there’s alignment, the recruiter reaches out directly.</p>
        </aside>
      </section>

      <section id="roles" className="public-section">
        <div className="public-section-heading">
          <div>
            <p className="eyebrow">Open roles</p>
            <h2>Current opportunities.</h2>
          </div>
          <p>Every role below is an active search. Company names may remain confidential until there is mutual alignment.</p>
        </div>
        <div className="role-list candidate-role-list">
          {(roles || []).map((role) => (
            <Link className="role-row candidate-role-card" href={`/jobs/${role.slug}`} key={role.job_id}>
              <div className="role-card-copy">
                <div className="role-card-badges">
                  {role.workplace ? <span>{role.workplace}</span> : null}
                  {role.location ? <span>{role.location}</span> : null}
                  {role.department ? <span>{role.department}</span> : null}
                </div>
                <strong>{role.title}</strong>
                {role.short_summary ? <RichText value={role.short_summary} className="role-summary" /> : null}
              </div>
              <span className="role-card-action">View opportunity <span aria-hidden="true">→</span></span>
            </Link>
          ))}
          {!roles?.length ? <p className="muted">No roles are published right now.</p> : null}
        </div>
      </section>

      <section className="public-section candidate-process">
        <div className="public-section-heading">
          <div>
            <p className="eyebrow">What to expect</p>
            <h2>A straightforward process.</h2>
          </div>
          <p>You should always know what you’re applying to and what happens next.</p>
        </div>

        <div className="candidate-process-grid">
          <article>
            <span>01</span>
            <strong>Explore</strong>
            <p>Review active opportunities and the information available for each search.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Apply</strong>
            <p>Share only the essentials. No account, password or repetitive profile setup.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Connect</strong>
            <p>If there’s a fit, the recruiter follows up directly with context and next steps.</p>
          </article>
        </div>
      </section>

      <section id="network" className="public-section">
        <p className="eyebrow">Join my network</p>
        <h2>Not seeing the right role?</h2>
        <p className="lede">
          Share your background once and stay available for future searches without applying to a specific role.
        </p>
        <PublicIntakeForm type="network" />
      </section>

      <footer className="public-footer">
        <div>
          <strong>JVRecruit</strong>
          <span>Thoughtful recruiting for technical, product, data and leadership talent.</span>
        </div>
        <Link href="/admin/login">Recruiter access</Link>
      </footer>
    </main>
  );
}
