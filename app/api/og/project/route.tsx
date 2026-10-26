/* eslint-disable @next/next/no-img-element -- ImageResponse uses Satori img elements, not the Next Image component. */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { outlineThumbnail } from "@/lib/maps/og-thumbnail";
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
  // Legacy generated aerials may contain text rasterized without system fonts.
  // Draw their real geometry with the bundled OG font instead of reusing that text.
  const useSourceImage = image && image.approval?.generated !== "gis-boundary-v1";
  let imageUrl = outlineThumbnail(data.item.geometry);
  if (useSourceImage)
    try {
      const response = await fetch(new URL(image.src, SITE_ORIGIN), {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.startsWith("image/")
      ) {
        const png = await sharp(Buffer.from(await response.arrayBuffer()))
          .resize(420, 630, { fit: "cover" })
          .png()
          .toBuffer();
        imageUrl = "data:image/png;base64," + png.toString("base64");
      }
    } catch {
      /* Keep the actual project outline when an approved asset is unavailable. */
    }
  const font = await readFile(path.join(process.cwd(), "public/fonts/Geist-Regular.ttf"));
  const rendered = new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
        fontFamily: "Geist",
        borderLeft: "20px solid " + color,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 48,
          width: imageUrl ? "64%" : "100%",
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
              : ["Decided", "Recorded"].includes(data.item.stage)
                ? "Decision recorded"
                : "Under review"}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#475569" }}>
            {data.area.name}
          </div>
        </div>
      </div>
      {imageUrl && (
        <div style={{display:"flex",position:"relative",width:420,height:630}}><img
          src={imageUrl}
          alt={useSourceImage ? image.alt : "Project outline (not a site plan)"}
          width={420}
          height={630}
          style={{ objectFit: "cover" }}
        /><div style={{display:"flex",position:"absolute",bottom:20,left:16,right:16,padding:10,background:"#ffffff",color:"#334155",fontSize:18}}>{useSourceImage ? image.label : "Project outline · not a site plan"}</div></div>
      )}
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Geist", data: font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer, weight: 400, style: "normal" }],
    },
  );
  const source = Buffer.from(await rendered.arrayBuffer());
  let jpeg = await sharp(source).jpeg({quality:80,mozjpeg:true}).toBuffer();
  if (jpeg.length > 150000) jpeg = await sharp(source).jpeg({quality:60,mozjpeg:true}).toBuffer();
  return new Response(new Uint8Array(jpeg), {headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=86400, s-maxage=86400"}});
}
