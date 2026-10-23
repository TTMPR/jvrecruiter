import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import PublicIntakeForm from "../../public-intake-form";
import RichText from "../../rich-text";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("job_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!job) notFound();

  return (
    <main className="public-shell">
      <header className="public-nav">
        <Link href="/"><strong>JVRecruit</strong></Link>
        <nav><Link href="/">Back to roles</Link></nav>
      </header>

      <article className="job-detail">
        <p className="eyebrow">{[job.department, job.workplace].filter(Boolean).join(" · ") || "Opportunity"}</p>
        <h1>{job.title}</h1>
        <p className="job-meta">{[job.location, job.employment_type, job.compensation].filter(Boolean).join(" · ")}</p>
        {job.short_summary ? <RichText value={job.short_summary} className="lede" /> : null}

        {job.description ? <section><h2>About the role</h2><RichText value={job.description} /></section> : null}
        {job.responsibilities ? <section><h2>What you’ll do</h2><RichText value={job.responsibilities} /></section> : null}
        {job.requirements ? <section><h2>What we’re looking for</h2><RichText value={job.requirements} /></section> : null}

        <section className="apply-section">
          <p className="eyebrow">Apply</p>
          <h2>Interested in this opportunity?</h2>
          <PublicIntakeForm type="application" jobId={job.job_id} />
        </section>
      </article>
    </main>
  );
}
