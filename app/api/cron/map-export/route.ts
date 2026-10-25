import { secretMatches } from "@/lib/timeline/auth";
import { exportMapFeatures } from "@/lib/maps/case-index";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (
    !secretMatches(
      request.headers.get("authorization") ?? "",
      process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  const cursor = new URL(request.url).searchParams.get("cursor") ?? "";
  if (cursor && !/^[a-z-]+:[A-Z0-9-]{1,100}$/.test(cursor))
    return Response.json({ error: "Invalid cursor" }, { status: 400 });
  return Response.json(await exportMapFeatures(cursor), {
    headers: { "Cache-Control": "no-store" },
  });
}
