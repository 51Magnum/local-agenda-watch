import { alertReadiness, alertsDb, subscribeAlert } from "@/lib/alerts";
import { headers } from "next/headers";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { revalidatePath } from "next/cache";
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
        `SELECT id,email,area_requested,latitude,longitude,radius_miles FROM law_coverage_requests r WHERE kind='follow' AND email IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL AND NOT EXISTS(SELECT 1 FROM law_alert_waitlist w WHERE w.id=r.id) ORDER BY created_at LIMIT 25`,
      )
    ).rows;
  for (const row of rows) {
    const claim = await db.query(
      "INSERT INTO law_alert_waitlist(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
      [row.id],
    );
    if (!claim.rows.length) continue;
    await subscribeAlert(
      row.email,
      {
        kind: "place",
        label: row.area_requested,
        coordinates: [Number(row.longitude), Number(row.latitude)],
        radiusMiles: Number(row.radius_miles ?? 1),
      },
      "waitlist:" + row.id,
    );
    await db.query("UPDATE law_alert_waitlist SET sent_at=now() WHERE id=$1", [
      row.id,
    ]);
  }
  revalidatePath("/admin/alerts");
}
export default async function AlertsAdmin() {
  const config = alertReadiness();
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-8">
      <h1 className="text-3xl font-semibold">Project alerts</h1>
      <p>
        {config.ready
          ? "Resend key and mailing address configured. Verify the sender domain in Resend before launch."
          : "Delivery paused: configure RESEND_API_KEY and ALERTS_MAILING_ADDRESS. Sender defaults to alerts@localagendawatch.com; replies go to hello@localagendawatch.com."}
      </p>
      <p>
        Existing waitlist entries receive no email unless the owner approves and
        enables ALERTS_WAITLIST_CONFIRMATIONS_ENABLED. This button sends one
        confirmation to each eligible entry with a saved map location. Entries
        without coordinates need a chosen place first.
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
    </main>
  );
}
