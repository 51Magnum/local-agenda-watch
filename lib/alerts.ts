import {databaseUrl} from "./runtime-environment";
import {getProjectForCase} from "./projects";
import { Pool } from "./database-pool";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AREAS } from "./areas/registry";
import { nearbyCases } from "./maps/spatial";
import type { MapCase } from "./maps/types";
import { projectDetail } from "./maps/project-detail";
import { SITE_ORIGIN } from "./site-config";
import { alertEmailDocument } from "./alert-email";
import { confirmationTemplate } from "./email/templates";
import { emailProject, type WatchState } from "./email/project";
export type WatchTarget =
  | { kind: "project"; areaId: string; caseId: string }
  | {
      kind: "place";
      label: string;
      coordinates: [number, number];
      radiusMiles: number;
    };
export type StoredWatchTarget = WatchTarget | { kind: "pending"; label: string };
export type Subscription = {
  id: string;
  email: string;
  target: StoredWatchTarget;
  state: WatchState | Record<string, string> | null;
  unsubscribe_token: string;
};
let pool: Pool, ready: Promise<unknown> | undefined;
export async function alertsDb() {
  if (!databaseUrl())
    throw Error("Alerts storage is not configured");
  pool ??= new Pool({ connectionString: databaseUrl(), max: 2,previewSignups:true });
  ready ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS law_alert_subscriptions(id uuid PRIMARY KEY,scope text NOT NULL,email text NOT NULL,target jsonb NOT NULL,confirm_hash text NOT NULL,confirm_expires timestamptz NOT NULL,unsubscribe_token text NOT NULL,confirmed_at timestamptz,unsubscribed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),state jsonb,last_sent date,UNIQUE(scope,email,target));CREATE INDEX IF NOT EXISTS law_alert_confirm ON law_alert_subscriptions(confirm_hash);CREATE TABLE IF NOT EXISTS law_alert_limits(key text NOT NULL,window_start timestamptz NOT NULL,hits int NOT NULL,PRIMARY KEY(key,window_start));CREATE TABLE IF NOT EXISTS law_alert_waitlist(id uuid PRIMARY KEY,sent_at timestamptz);
ALTER TABLE law_alert_subscriptions ADD COLUMN IF NOT EXISTS coverage_announcements boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS law_alert_deliveries(id text PRIMARY KEY,scope text NOT NULL,email text NOT NULL,kind text NOT NULL,payload jsonb NOT NULL,states jsonb,status text NOT NULL DEFAULT 'pending',sent_parts int NOT NULL DEFAULT 0,attempts int NOT NULL DEFAULT 0,last_error text,next_attempt timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz);
CREATE INDEX IF NOT EXISTS law_alert_delivery_due ON law_alert_deliveries(scope,status,next_attempt);
CREATE TABLE IF NOT EXISTS law_alert_recipient_checks(scope text NOT NULL,email text NOT NULL,last_checked timestamptz NOT NULL,PRIMARY KEY(scope,email));`,
    )
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
  return pool;
}
export const alertScope = () =>
  process.env.VERCEL_ENV === "production"
    ? "production"
    : "preview:" + (process.env.VERCEL_GIT_COMMIT_REF??"local");
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
  const deliveryEnabled=process.env.ALERTS_DELIVERY_ENABLED === "true" && process.env.VERCEL_ENV === "production";
  return {
    ready: !!(process.env.RESEND_API_KEY?.trim() && process.env.ALERTS_MAILING_ADDRESS?.trim()),
    deliveryEnabled,
    waitlistEnabled:
      deliveryEnabled && process.env.ALERTS_WAITLIST_CONFIRMATIONS_ENABLED === "true",
  };
}
export async function sendAlertMail({
  to,
  subject,
  text,
  html,
  key,
  unsubscribe,
  mode = "live",
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  key: string;
  unsubscribe: string;
  mode?: "live" | "test" | "internal";
}) {
  if(mode!=="test"&&!alertReadiness().deliveryEnabled)throw Error("Live email delivery is paused pending owner approval");
  if(mode==="internal"&&to!=="corrections@localagendawatch.com")throw Error("Internal corrections mail has a fixed recipient");
  if(to.length>254||!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to))throw Error("Enter one valid recipient address");
  if (!alertReadiness().ready)
    throw Error("Alerts need a verified Resend sender and mailing address");
  const complete=!!html?.startsWith("<!doctype html>");
  const htmlPart=complete?html:html?alertEmailDocument(html,process.env.ALERTS_MAILING_ADDRESS!,unsubscribe):undefined;
  const textPart=complete?text:text+"\n\nUpdated automatically from public records. Official records control.\nLocal Agenda Watch\n"+process.env.ALERTS_MAILING_ADDRESS+"\nUnsubscribe from all alerts: "+unsubscribe;
  if(!htmlPart)throw Error("Every email requires an HTML and plain-text part");
  if(Buffer.byteLength(htmlPart)+Buffer.byteLength(textPart)>=68000)throw Error("Email exceeds the 100 KB size limit");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: "Local Agenda Watch <alerts@localagendawatch.com>",
      reply_to: "hello@localagendawatch.com",
      to: [to],
      subject: (mode==="test"?"[TEST] ":"")+subject,
      html:htmlPart,
      text:textPart,
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
  options:{reconsent?:boolean}={},
) {
  if (!alertReadiness().ready || !alertReadiness().deliveryEnabled)
    throw Error("Email alerts are not configured yet");
  const detail=target.kind==="project"?await projectDetail(target.areaId,target.caseId):undefined;
  if(target.kind==="project"&&!detail)throw Error("Project data could not be verified");
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
      ...confirmationTemplate(target,url,{mailingAddress:process.env.ALERTS_MAILING_ADDRESS!,unsubscribe:remove,manage:origin+"/api/alerts/manage?token="+unsubscribe},detail?emailProject(detail):undefined,options.reconsent),
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
  return (await import("./email/jobs")).sendScheduledAlerts();
}
