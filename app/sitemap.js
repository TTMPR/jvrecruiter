import { createClient } from "../lib/supabase/server";

export default async function sitemap() {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("job_posts")
    .select("slug, updated_at, published_at")
    .eq("published", true);

  const jobs = (roles || []).map((role) => ({
    url: `https://jvrecruiter.xyz/jobs/${role.slug}`,
    lastModified: role.updated_at || role.published_at || new Date().toISOString(),
    changeFrequency: "daily",
    priority: 0.8
  }));

  return [
    {
      url: "https://jvrecruiter.xyz",
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 1
    },
    ...jobs
  ];
}
