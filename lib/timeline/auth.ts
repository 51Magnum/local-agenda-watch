import { createHash, timingSafeEqual } from "node:crypto";
export function secretMatches(value: string, expected: string | undefined): boolean {
  if (!expected) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(expected).digest());
}
export function authorizedReviewer(authorization: string | null, password = process.env.REVIEW_ADMIN_PASSWORD): boolean {
  if (!password || !authorization?.startsWith("Basic ")) return false;
  try { const value = Buffer.from(authorization.slice(6), "base64").toString("utf8"); return value.startsWith("admin:") && secretMatches(value.slice(6), password); }
  catch { return false; }
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); } catch { return false; }
}
