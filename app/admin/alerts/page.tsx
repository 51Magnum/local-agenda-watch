import { alertReadiness, alertsDb, alertScope, subscribeAlert, type StoredWatchTarget } from "@/lib/alerts";
import { headers } from "next/headers";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
export const dynamic = "force-dynamic";
async function sendWaitlist() {
  "use server";
  if (
    !authorizedReviewer((await headers()).get("authorization")) ||
    !alertReadiness().waitlistEnabled
  )
    throw Error("Waitlist sending is disabled until owner approval");
  const db = await alertsDb(),
    rows = (
      await db.query(
        `SELECT DISTINCT ON(lower(email)) id,email,area_requested,latitude,longitude,radius_miles FROM law_coverage_requests r WHERE kind='follow' AND email IS NOT NULL AND NOT EXISTS(SELECT 1 FROM law_alert_waitlist w JOIN law_coverage_requests old ON old.id=w.id WHERE lower(old.email)=lower(r.email)) ORDER BY lower(email),created_at LIMIT 25`,
      )
    ).rows;
  for (const row of rows) {
    const claim = await db.query(
      "INSERT INTO law_alert_waitlist(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
      [row.id],
    );
    if (!claim.rows.length) continue;
    try{const result=await subscribeAlert(
      row.email,
      row.latitude != null && row.longitude != null
        ? {
            kind: "place",
            label: row.area_requested,
            coordinates: [Number(row.longitude), Number(row.latitude)],
            radiusMiles: Number(row.radius_miles ?? 1),
          }
        : { kind: "pending", label: row.area_requested },
      "waitlist:" + row.id,
      undefined,
      {reconsent:true},
    );
    if(result.limited)throw Error("Waitlist confirmation rate-limited; retain for retry");
    await db.query("UPDATE law_alert_waitlist SET sent_at=now() WHERE id=$1", [
      row.id,
    ]);
    }catch{await db.query("DELETE FROM law_alert_waitlist WHERE id=$1 AND sent_at IS NULL",[row.id]);}
  }
  revalidatePath("/admin/alerts");
}
export default async function AlertsAdmin() {
  if (!authorizedReviewer((await headers()).get("authorization"))) throw Error("Admin sign-in required");
  const config = alertReadiness();
  let watches: {email:string;target:StoredWatchTarget;confirmed_at:string|null;unsubscribed_at:string|null}[] = [], watchError = false;
  try {
    watches=(await (await alertsDb()).query("SELECT email,target,confirmed_at,unsubscribed_at FROM law_alert_subscriptions WHERE scope=$1 ORDER BY created_at DESC LIMIT 100",[alertScope()])).rows;
  } catch { watchError = true; }
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-8">
      <h1 className="text-3xl font-semibold">Project alerts</h1>
      <Link href="/admin/emails" className="underline">Preview all email templates and send an explicit admin test</Link>
      <p>{config.deliveryEnabled?"Production delivery gate enabled.":"Live email delivery is paused pending owner approval. Preview deployments cannot send to subscribers."}</p>
      <p>
        {config.ready
          ? "Resend key and mailing address configured. Verify the sender domain in Resend before launch."
          : "Delivery paused: configure RESEND_API_KEY and ALERTS_MAILING_ADDRESS. Sender defaults to alerts@localagendawatch.com; replies go to hello@localagendawatch.com."}
      </p>
      <p>
        Existing waitlist entries receive no email unless the owner approves and
        enables ALERTS_WAITLIST_CONFIRMATIONS_ENABLED. This sends one
        confirmation per email. Entries without a saved location are asked to
        choose a project or address before alerts start.
      </p>
      <form action={sendWaitlist}>
        <button
          className="rounded border px-4 py-2 disabled:opacity-50"
          disabled={!config.ready || !config.waitlistEnabled}
        >
          Send confirmations to waitlist
        </button>
      </form>
      <p>
        Confirmed watches receive at most one daily digest per email when a
        filing, hearing or decision changes. First run records a baseline. No
        changes means no email.
      </p>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Latest watch requests</h2>
        <p>Private admin view for this deployment’s records; preview and production can use separate records. A map pin is a browser selection and does not verify subscription status. Showing up to 100 latest requests.</p>
        {watchError ? <p>Watch status is unavailable. Check the database configuration.</p> : !watches.length ? <p>No watch requests in this deployment’s records.</p> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Email</th><th className="p-2">Watch</th><th className="p-2">Status</th></tr></thead><tbody>{watches.map((watch,i)=><tr key={i} className="border-t">
          <td className="p-2">{watch.email}</td>
          <td className="p-2">{watch.target.kind==="project" ? `${watch.target.areaId} · ${watch.target.caseId}` : watch.target.label}{watch.target.kind==="place" ? ` · ${watch.target.radiusMiles} mi` : ""}</td>
          <td className="p-2">{watch.unsubscribed_at ? "Unsubscribed" : !watch.confirmed_at ? "Awaiting email confirmation" : watch.target.kind==="pending" ? "Email confirmed; no project or place selected" : "Confirmed watch"}</td>
        </tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
