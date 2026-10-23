import Link from "next/link";

export default function HomePage() {
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
          Curated technical, product, data and leadership opportunities with a
          more thoughtful recruiting experience.
        </p>
        <p className="affiliation">
          Current searches managed through Towerhill Associates.
        </p>
      </section>

      <section id="roles" className="public-section">
        <p className="eyebrow">Open roles</p>
        <h2>Current opportunities.</h2>
        <p>Published roles will load here from Supabase.</p>
      </section>

      <section id="network" className="public-section">
        <p className="eyebrow">Join my network</p>
        <h2>Not seeing the right role?</h2>
        <p>
          Share your background and JVRecruit can keep your profile available
          for future searches without applying to a specific position.
        </p>
      </section>
    </main>
  );
}
