import { meetingsList } from "@/lib/meetings-list";
import { AREAS } from "@/lib/areas/registry";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams,
    area = q.get("area") ?? "",
    year = Number(q.get("year"));
  if (
    !AREAS[area] ||
    !Number.isInteger(year) ||
    year < 2023 ||
    year > new Date().getUTCFullYear()
  )
    return new Response("Invalid archive", { status: 400 });
  return Response.json(await meetingsList(area, year), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" },
  });
}
