import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Local Agenda Watch";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#a1a1aa",
          }}
        >
          Local Agenda Watch
        </div>
        <div
          style={{
            fontSize: 72,
            lineHeight: 1.1,
            fontWeight: 600,
            maxWidth: "90%",
          }}
        >
          What&apos;s being built near you?
        </div>
        <div style={{ fontSize: 24, color: "#a1a1aa" }}>
          localagendawatch.com
        </div>
      </div>
    ),
    { ...size }
  );
}
