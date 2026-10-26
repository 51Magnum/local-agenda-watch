import {withDbTransfer,currentDbTransfer} from "@/lib/db-transfer";
import { projectDetail } from "@/lib/maps/project-detail";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams,
    area = q.get("area") ?? "",
    id = q.get("case") ?? "";
  if (!/^[a-z-]+$/.test(area) || !/^[-A-Z0-9]{2,80}$/.test(id))
    return Response.json({ error: "Invalid project" }, { status: 400 });
  return withDbTransfer(async()=>{const data = await projectDetail(area, id);const metrics=currentDbTransfer();
  return data
    ? Response.json(data, {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=60", "X-LAW-Origin-Queries":String(metrics?.readQueries??0) },
      })
    : Response.json({ error: "Project not found" }, { status: 404 });});
}
