import { mapManifest } from "@/lib/maps/case-index";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET() {
  return Response.json(await mapManifest(), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
  });
}
