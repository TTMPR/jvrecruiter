import { ImageResponse } from "next/og";
import { createClient } from "../../../lib/supabase/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_posts")
    .select("title,department,location,workplace")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  const title = job?.title || "Opportunity";
  const meta = [job?.department, job?.location, job?.workplace].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f0e8",
          color: "#102d35",
          padding: "64px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>JVRecruit</div>
          <div style={{ fontSize: 22, color: "#68756f" }}>Open Role</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1020 }}>
          <div style={{ fontSize: 64, lineHeight: 1.03 }}>{title}</div>
          {meta ? <div style={{ fontSize: 26, color: "#53635d" }}>{meta}</div> : null}
        </div>

        <div style={{ fontSize: 22, color: "#68756f" }}>jvrecruiter.xyz</div>
      </div>
    ),
    size
  );
}
