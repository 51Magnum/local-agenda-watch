import { createHash, timingSafeEqual } from "node:crypto";
export function secretMatches(value: string, expected: string | undefined): boolean {
  if (!expected) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(expected).digest());
}
export function reviewerIdentity(authorization: string | null, password = process.env.REVIEW_ADMIN_PASSWORD): string|undefined {
  if (!password || !authorization?.startsWith("Basic ")) return;
  try { const value = Buffer.from(authorization.slice(6), "base64").toString("utf8"),colon=value.indexOf(":"),username=value.slice(0,colon);return username==="admin"&&secretMatches(value.slice(colon+1),password)?username:undefined; }
  catch { return; }
}
export function authorizedReviewer(authorization:string|null,password=process.env.REVIEW_ADMIN_PASSWORD){return !!reviewerIdentity(authorization,password);}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); } catch { return false; }
}
