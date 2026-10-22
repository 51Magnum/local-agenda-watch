import { getLocality } from "@/lib/localities";
import { braeburnCreek, getProjectNextHearing, hearingCalendar } from "@/lib/projects";

export async function GET() {
  const locality = getLocality("nampa");
  const feed = await locality?.getHearings?.().catch((err: unknown) => {
    console.error("[project-calendar] Feed unavailable", err);
    return undefined;
  });
  const next = getProjectNextHearing(braeburnCreek, feed);
  const calendar = next && hearingCalendar(braeburnCreek, next);
  if (!calendar) return new Response("No hearing scheduled yet.", { status: 404 });
  return new Response(calendar, { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="braeburn-creek-hearing.ics"',
    "Cache-Control": "no-store",
  } });
}
