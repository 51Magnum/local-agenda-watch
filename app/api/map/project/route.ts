import { projectDetail } from "@/lib/maps/project-detail";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams,
    area = q.get("area") ?? "",
    id = q.get("case") ?? "";
  if (!/^[a-z-]+$/.test(area) || !/^[-A-Z0-9]{2,80}$/.test(id))
    return Response.json({ error: "Invalid project" }, { status: 400 });
  const data = await projectDetail(area, id);
  return data
    ? Response.json(data, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      })
    : Response.json({ error: "Project not found" }, { status: 404 });
}
