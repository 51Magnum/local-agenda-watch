import { hearingDateTime } from "./areas/format";
import {getProjectForCase} from "./projects";
import { Pool } from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AREAS } from "./areas/registry";
import { nearbyCases } from "./maps/spatial";
import type { MapCase } from "./maps/types";
import { projectDetail } from "./maps/project-detail";
import { SITE_ORIGIN } from "./site-config";
export type WatchTarget =
  | { kind: "project"; areaId: string; caseId: string }
  | {
      kind: "place";
      label: string;
      coordinates: [number, number];
      radiusMiles: number;
    };
type StoredWatchTarget = WatchTarget | { kind: "pending"; label: string };
type Subscription = {
  id: string;
  email: string;
  target: StoredWatchTarget;
  state: Record<string, string> | null;
  unsubscribe_token: string;
};
let pool: Pool, ready: Promise<unknown> | undefined;
export async function alertsDb() {
  if (!process.env.DATABASE_URL)
    throw Error("Alerts storage is not configured");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  ready ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS law_alert_subscriptions(id uuid PRIMARY KEY,scope text NOT NULL,email text NOT NULL,target jsonb NOT NULL,confirm_hash text NOT NULL,confirm_expires timestamptz NOT NULL,unsubscribe_token text NOT NULL,confirmed_at timestamptz,unsubscribed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),state jsonb,last_sent date,UNIQUE(scope,email,target));CREATE INDEX IF NOT EXISTS law_alert_confirm ON law_alert_subscriptions(confirm_hash);CREATE TABLE IF NOT EXISTS law_alert_limits(key text NOT NULL,window_start timestamptz NOT NULL,hits int NOT NULL,PRIMARY KEY(key,window_start));CREATE TABLE IF NOT EXISTS law_alert_waitlist(id uuid PRIMARY KEY,sent_at timestamptz);`,
    )
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
  return pool;
}
export const alertScope = () =>
  process.env.VERCEL_ENV === "preview"
    ? "preview:" + process.env.VERCEL_GIT_COMMIT_REF
    : "production";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function parseWatchTarget(value: unknown): WatchTarget {
  if (!value || typeof value !== "object")
    throw Error("Choose a project or a place");
  const v = value as Record<string, unknown>;
  if (
    v.kind === "project" &&
    typeof v.areaId === "string" &&
    AREAS[v.areaId]?.status === "live" &&
    typeof v.caseId === "string" &&
    /^[A-Z0-9-]{3,60}$/i.test(v.caseId)
  )
    return {
      kind: "project",
      areaId: v.areaId,
      caseId: v.caseId.toUpperCase(),
    };
  if (
    v.kind === "place" &&
    typeof v.label === "string" &&
    v.label.trim().length > 0 &&
    v.label.length <= 300 &&
    Array.isArray(v.coordinates) &&
    v.coordinates.length === 2 &&
    v.coordinates.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(v.coordinates[0]) <= 180 &&
    Math.abs(v.coordinates[1]) <= 85 &&
    typeof v.radiusMiles === "number" &&
    v.radiusMiles >= 0.25 &&
    v.radiusMiles <= 10
  )
    return {
      kind: "place",
      label: v.label.trim(),
      coordinates: v.coordinates as [number, number],
      radiusMiles: v.radiusMiles,
    };
  throw Error("Choose a valid project or a place with a 0.25–10 mile radius");
}
export function alertReadiness() {
  return {
    ready: !!(process.env.RESEND_API_KEY && process.env.ALERTS_MAILING_ADDRESS),
    waitlistEnabled:
      process.env.ALERTS_WAITLIST_CONFIRMATIONS_ENABLED === "true",
  };
}
export async function sendAlertMail({
  to,
  subject,
  text,
  key,
  unsubscribe,
}: {
  to: string;
  subject: string;
  text: string;
  key: string;
  unsubscribe: string;
}) {
  if (!alertReadiness().ready)
    throw Error("Alerts need a verified Resend sender and mailing address");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from:
        process.env.ALERTS_FROM ??
        "Local Agenda Watch <alerts@localagendawatch.com>",
      reply_to: process.env.ALERTS_REPLY_TO ?? "hello@localagendawatch.com",
      to: [to],
      subject,
      text:
        text +
        "\n\nLocal Agenda Watch · Independent summaries; official records control.\n" +
        process.env.ALERTS_MAILING_ADDRESS +
        "\nUnsubscribe from all alerts: " +
        unsubscribe,
      headers: {
        "List-Unsubscribe": "<" + unsubscribe + ">",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw Error("Email delivery unavailable (HTTP " + r.status + ")");
  return (await r.json()).id as string;
}
export async function subscribeAlert(
  email: string,
  target: StoredWatchTarget,
  ip: string,
  origin = SITE_ORIGIN,
) {
  if (!alertReadiness().ready)
    throw Error("Email alerts are not configured yet");
  const db = await alertsDb(),
    now = new Date();
  email = email.trim().toLowerCase();
  for (const [key, window, limit] of [
    ["ip:" + hash(ip), now.toISOString().slice(0, 13) + ":00:00Z", 5],
    ["email:" + hash(email), now.toISOString().slice(0, 10) + "T00:00:00Z", 3],
  ] as const) {
    const row = await db.query(
      `INSERT INTO law_alert_limits VALUES($1,$2,1) ON CONFLICT(key,window_start) DO UPDATE SET hits=law_alert_limits.hits+1 WHERE law_alert_limits.hits<$3 RETURNING hits`,
      [key, window, limit],
    );
    if (!row.rows.length) return { limited: true };
  }
  const token = randomBytes(32).toString("base64url"),
    unsubscribe = randomBytes(32).toString("base64url");
  const row = await db.query(
    `INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token) VALUES($1,$2,$3,$4,$5,now()+interval '2 days',$6) ON CONFLICT(scope,email,target) DO UPDATE SET confirm_hash=excluded.confirm_hash,confirm_expires=excluded.confirm_expires,unsubscribe_token=excluded.unsubscribe_token,unsubscribed_at=NULL,confirmed_at=NULL,state=NULL WHERE law_alert_subscriptions.confirmed_at IS NULL OR law_alert_subscriptions.unsubscribed_at IS NOT NULL RETURNING id`,
    [
      randomUUID(),
      alertScope(),
      email,
      JSON.stringify(target),
      hash(token),
      unsubscribe,
    ],
  );
  if (!row.rows.length) return { limited: false };
  const id = row.rows[0].id,
    url = origin + "/api/alerts/confirm?token=" + token,
    remove = origin + "/api/alerts/unsubscribe?token=" + unsubscribe;
  try {
    await sendAlertMail({
      to: email,
      subject: "Confirm your Local Agenda Watch alerts",
      text:
        "Confirm that you want a daily email when " +
        (target.kind === "project"
          ? "this project changes: " + target.caseId
          : target.kind === "place"
            ? target.label + " changes within " + target.radiusMiles + " miles"
            : "your interest in " +
              target.label +
              ". After confirmation, choose a project or address on the map before alerts can start") +
        ".\n\n" +
        url +
        "\n\nThis link expires in 48 hours. No alerts start until you confirm.",
      key: "confirm/" + id + "/" + hash(token),
      unsubscribe: remove,
    });
  } catch (e) {
    await db.query(
      "DELETE FROM law_alert_subscriptions WHERE id=$1 AND confirmed_at IS NULL",
      [id],
    );
    throw e;
  }
  return { limited: false };
}
export async function confirmAlert(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return false;
  const r = await (
    await alertsDb()
  ).query(
    `UPDATE law_alert_subscriptions SET confirmed_at=coalesce(confirmed_at,now()) WHERE scope=$2 AND confirm_hash=$1 AND confirm_expires>now() AND unsubscribed_at IS NULL RETURNING target`,
    [hash(token), alertScope()],
  );
  return r.rows[0]?.target as StoredWatchTarget | undefined;
}
export async function unsubscribeAlert(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return false;
  const r = await (
    await alertsDb()
  ).query(
    `UPDATE law_alert_subscriptions SET unsubscribed_at=now() WHERE (scope,email) IN(SELECT scope,email FROM law_alert_subscriptions WHERE unsubscribe_token=$1) RETURNING id`,
    [token],
  );
  return !!r.rows.length;
}
export function watchMatches(target: StoredWatchTarget, rows: MapCase[]) {
  if (target.kind === "pending") return [];
  return target.kind === "place"
    ? nearbyCases(rows, target.coordinates, target.radiusMiles)
    : rows.filter(
        (c) =>
          c.areaId === target.areaId &&
          (c.id === target.caseId || c.caseIds?.includes(target.caseId)||getProjectForCase(target.caseId,target.areaId)?.caseIds.includes(c.id)),
      );
}
export const watchFingerprint = (c: MapCase) =>
  hash(
    JSON.stringify([
      c.caseDate,
      c.title,
      c.stage,
      c.recordStatus,
      c.decisionDate,
      c.nextHearing,
    ]),
  );
export async function sendDigests() {
  if (!alertReadiness().ready)
    return { sent: 0, skipped: "Email alerts are not configured" };
  const db = await alertsDb(),
    subs = (
      await db.query(
        `SELECT id,email,target,state,unsubscribe_token FROM law_alert_subscriptions WHERE scope=$1 AND confirmed_at IS NOT NULL AND target->>'kind'<>'pending' AND unsubscribed_at IS NULL AND (last_sent IS NULL OR last_sent<CURRENT_DATE) ORDER BY email,id LIMIT 250`,
        [alertScope()],
      )
    ).rows as Subscription[];
  if (!subs.length) return { sent: 0, checked: 0 };
  const rows = (
    await db.query(
      `SELECT area_id AS "areaId",data-'visual'-'popup' AS data FROM law_map_cases WHERE area_id=ANY($1::text[])`,
      [
        Object.values(AREAS)
          .filter((a) => a.status === "live")
          .map((a) => a.id),
      ],
    )
  ).rows.map((r) => ({ ...r.data, areaId: r.areaId })) as MapCase[];
  const grouped = new Map<string, Subscription[]>();
  for (const s of subs)
    grouped.set(s.email, [...(grouped.get(s.email) ?? []), s]);
  let sent = 0;
  for (const [email, watches] of grouped) {
    const states = new Map<string, Record<string, string>>(),
      changed = new Map<string, MapCase>();
    for (const sub of watches) {
      const matches = watchMatches(sub.target, rows),
        state = Object.fromEntries(
          matches.map((c) => [c.areaId + ":" + c.id, watchFingerprint(c)]),
        );
      states.set(sub.id, state);
      if (sub.state)
        for (const c of matches) {
          const key = c.areaId + ":" + c.id;
          if (state[key] !== sub.state[key]) changed.set(key, c);
        }
    }
    if (changed.size) {
      const text: string[] = [];
      for (const c of [...changed.values()].slice(0, 20)) {
        const d = await projectDetail(c.areaId!, c.id);
        if (!d) continue;
        const link = SITE_ORIGIN + "/?project=" + c.areaId + "/" + c.id;
        text.push(
          "What is it: " +
            (d.item.popup?.headline ?? d.item.title) +
            "\nWhat's next: " +
            (d.next
              ? d.next.body +
                " · " +
                hearingDateTime(d.next.startsAt, d.area.timezone)
              : (d.item.recordStatus ??
                d.history.at(-1)?.label ??
                d.item.stage)) +
            "\nHow can I act: " +
            (d.participationClosed
              ? "Read the official decision and project history"
              : (d.expiredDeadlineMessage ??
                "Check the official notice for comment options and deadlines")) +
            "\n" +
            link +
            (d.commentUrl
              ? "\nOfficial comment information: " +
                new URL(d.commentUrl, SITE_ORIGIN).href
              : ""),
        );
      }
      if (text.length) {
        await sendAlertMail({
          to: email,
          subject: `${changed.size} project update${changed.size === 1 ? "" : "s"} near your watched places`,
          text: text.join("\n\n"),
          key:
            "digest/" +
            hash(email) +
            ":" +
            alertScope() +
            ":" +
            new Date().toISOString().slice(0, 10),
          unsubscribe:
            SITE_ORIGIN +
            "/api/alerts/unsubscribe?token=" +
            watches[0].unsubscribe_token,
        });
        sent++;
      }
    }
    await db.query(
      `UPDATE law_alert_subscriptions s SET state=x->'state',last_sent=CURRENT_DATE FROM jsonb_array_elements($1::jsonb)x WHERE s.id=(x->>'id')::uuid AND s.unsubscribed_at IS NULL`,
      [
        JSON.stringify(
          watches.map((s) => ({ id: s.id, state: states.get(s.id) })),
        ),
      ],
    );
  }
  return { sent, checked: subs.length };
}
