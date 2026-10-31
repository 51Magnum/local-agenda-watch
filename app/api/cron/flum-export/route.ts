import {previewMutationResponse} from "@/lib/runtime-environment";
import { secretMatches } from "@/lib/timeline/auth";
import { exportFlumPage } from "@/lib/maps/store";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
 const disabled=previewMutationResponse();if(disabled)return disabled;

  if (
    !secretMatches(
      request.headers.get("authorization") ?? "",
      process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  const q = new URL(request.url).searchParams,
    area = q.get("area") ?? "",
    offset = Number(q.get("offset") ?? 0);
  if (
    !getJurisdiction(area)?.flum.layerUrl ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  )
    return Response.json(
      { error: "Invalid FLUM export page" },
      { status: 400 },
    );
  return Response.json(await exportFlumPage(area, offset), {
    headers: { "Cache-Control": "no-store" },
  });
}
