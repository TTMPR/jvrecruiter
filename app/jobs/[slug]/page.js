import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import PublicIntakeForm from "../../public-intake-form";
import RichText from "../../rich-text";

export const dynamic = "force-dynamic";

function plainText(value = "") {
  return String(value)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlDescription(job) {
  const sections = [
    job.description,
    job.responsibilities ? `Responsibilities:\n${job.responsibilities}` : null,
    job.requirements ? `Requirements:\n${job.requirements}` : null
  ].filter(Boolean);

  return sections
    .map((section) => {
      const lines = String(section).split("\n").filter(Boolean);
      const items = lines.filter((line) => /^\s*(?:-|\d+\.)\s+/.test(line));
      if (items.length === lines.length && items.length) {
        return `<ul>${items.map((line) => `<li>${plainText(line)}</li>`).join("")}</ul>`;
      }
      return `<p>${plainText(section)}</p>`;
    })
    .join("");
}

function employmentType(value) {
  const map = {
    "Full-time": "FULL_TIME",
    "Part-time": "PART_TIME",
    "Contract": "CONTRACTOR"
  };
  return map[value] || undefined;
}

async function getJob(slug) {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return job;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const job = await getJob(slug);

  if (!job) {
    return {
      title: "Role not found",
      robots: { index: false, follow: false }
    };
  }

  const description = plainText(job.short_summary || job.description || "")
    .slice(0, 160);

  return {
    title: job.title,
    description,
    alternates: {
      canonical: `/jobs/${job.slug}`
    },
    openGraph: {
      type: "website",
      url: `https://jvrecruiter.xyz/jobs/${job.slug}`,
      title: job.title,
      description
    },
    twitter: {
      card: "summary_large_image",
      title: job.title,
      description
    }
  };
}

export default async function JobPage({ params }) {
  const { slug } = await params;
  const job = await getJob(slug);

  if (!job) notFound();

  const remote = String(job.workplace || "").toLowerCase() === "remote";

  const jobPosting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: htmlDescription(job),
    identifier: {
      "@type": "PropertyValue",
      name: "JVRecruit",
      value: job.job_id
    },
    datePosted: job.published_at || job.created_at,
    employmentType: employmentType(job.employment_type),
    hiringOrganization: {
      "@type": "Organization",
      name: "confidential"
    },
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "USA"
          }
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location || "United States",
              addressCountry: "US"
            }
          }
        })
  };

  return (
    <main className="public-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPosting).replace(/</g, "\\u003c")
        }}
      />

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
