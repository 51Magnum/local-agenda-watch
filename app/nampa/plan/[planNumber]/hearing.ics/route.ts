import { findHearing, getLocality } from "@/lib/localities";
import { getCaseNextHearing } from "@/lib/case-details";
import { getProjectForCase, hearingCalendar } from "@/lib/projects";

export async function GET(_request: Request, { params }: { params: Promise<{ planNumber: string }> }) {
  const { planNumber } = await params;
  const feed = await getLocality("nampa")?.getHearings?.();
  if (!feed) return new Response("Case not found", { status: 404 });
  const hearing = findHearing(feed.active, planNumber) ?? findHearing(feed.completed, planNumber) ?? findHearing(feed.upcomingOnly ?? [], planNumber);
  if (!hearing) return new Response("Case not found", { status: 404 });
  const next = getCaseNextHearing(hearing, feed);
  const curated = getProjectForCase(hearing.appId);
  const calendar = next && hearingCalendar(curated ?? {
    slug: hearing.appId.toLowerCase(), title: hearing.appScope || hearing.appId,
    path: "plan/" + encodeURIComponent(hearing.appId),
  }, next);
  if (!calendar) return new Response("No confirmed hearing time available.", { status: 404 });
  return new Response(calendar, { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="' + hearing.appId.toLowerCase().replace(/[^a-z0-9-]/g, "") + '-hearing.ics"',
    "Cache-Control": "no-store",
  } });
}
