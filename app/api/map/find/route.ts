import { projectDirectory } from "@/lib/maps/case-index";
import { findProjects } from "@/lib/maps/project-search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) return Response.json({ error: "Enter 2–100 characters." }, { status: 400 });
  try {
    return Response.json({ projects: findProjects(await projectDirectory(), q) }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" },
    });
  } catch {
    return Response.json({ error: "Project search is unavailable. Please try again." }, { status: 503 });
  }
}
