import {previewMutationResponse} from "@/lib/runtime-environment";
import { alertReadiness, sendDigests } from "@/lib/alerts";
import { secretMatches } from "@/lib/timeline/auth";
import {
  acquireLease,
  releaseLease,
  getEvidenceStore,
} from "@/lib/timeline/store";
export const maxDuration = 300;
export async function GET(request: Request) {
 const disabled=previewMutationResponse();if(disabled)return disabled;

  if (
    !secretMatches(
      (request.headers.get("authorization") ?? "").replace(/^Bearer /, ""),
      process.env.CRON_SECRET,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  const readiness = alertReadiness();
  if (new URL(request.url).searchParams.get("status") === "1")
    return Response.json(readiness, { headers: { "Cache-Control": "no-store" } });
  if(!readiness.deliveryEnabled)return Response.json({sent:0,skipped:"Live email delivery is paused pending owner approval"},{headers:{"Cache-Control":"no-store"}});
  const store = getEvidenceStore(),
    lease = await acquireLease(store, "alert-digest", 300000);
  if (!lease)
    return Response.json(
      { skipped: "Digest already running" },
      { status: 409 },
    );
  try {
    return Response.json(await sendDigests(), {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    await releaseLease(store, "alert-digest", lease);
  }
}
