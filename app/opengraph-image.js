import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
        <div style={{ fontSize: 34, fontWeight: 800 }}>JVRecruit</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, lineHeight: 1.02, maxWidth: 980 }}>
            Find your next opportunity without the noise.
          </div>
          <div style={{ fontSize: 26, color: "#53635d" }}>
            Technical · Product · Data · AI · Leadership
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#68756f" }}>jvrecruiter.xyz</div>
      </div>
    ),
    size
  );
}
