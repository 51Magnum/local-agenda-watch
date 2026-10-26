export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    provider: process.env.VERCEL_GIT_PROVIDER ?? null,
    environment: process.env.VERCEL_ENV ?? "local",
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}
