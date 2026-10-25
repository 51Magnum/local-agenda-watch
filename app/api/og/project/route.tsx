/* eslint-disable @next/next/no-img-element -- ImageResponse uses Satori img elements, not the Next Image component. */
import { ImageResponse } from "next/og";
import { projectDetail } from "@/lib/maps/project-detail";
import { AREAS } from "@/lib/areas/registry";
import { SITE_ORIGIN } from "@/lib/site-config";
import { hearingDateTime } from "@/lib/areas/format";
export const runtime = "nodejs";
export const revalidate = 86400;
const colors = [
  "#0f766e",
  "#0369a1",
  "#6d28d9",
  "#b45309",
  "#be185d",
  "#166534",
  "#4338ca",
];
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams,
    area = q.get("area") ?? "",
    id = q.get("case") ?? "";
  if (!AREAS[area] || !/^[A-Z0-9-]+$/i.test(id))
    return new Response("Not found", { status: 404 });
  const data = await projectDetail(area, id.toUpperCase());
  if (!data) return new Response("Not found", { status: 404 });
  const color =
      colors[Math.max(0, Object.keys(AREAS).indexOf(area)) % colors.length],
    image = data.item.visual;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
        fontFamily: "sans-serif",
        borderLeft: "20px solid " + color,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 48,
          width: image ? "64%" : "100%",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color, fontWeight: 700 }}>
          LAW · Local Agenda Watch
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 48,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {data.item.popup?.headline ?? data.item.title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 26, color }}>
            {data.next
              ? data.next.body +
                " · " +
                hearingDateTime(data.next.startsAt, data.area.timezone)
              : data.item.stage === "Decided"
                ? "Decision recorded"
                : "Under review"}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#475569" }}>
            {data.area.name}
          </div>
        </div>
      </div>
      {image && (
        <img
          src={new URL(image.src, SITE_ORIGIN).href}
          alt={image.alt}
          width={420}
          height={630}
          style={{ objectFit: "cover" }}
        />
      )}
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
