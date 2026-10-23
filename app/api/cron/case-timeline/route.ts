import { nampaPublicClientHints } from "@/lib/sources/energov-public-client";
import { reviewRunSummary } from "@/lib/timeline/run-summary";
import { secretMatches } from "@/lib/timeline/auth";
import { acquireLease, getEvidenceStore, releaseLease } from "@/lib/timeline/store";
import { discoverCaseDocuments } from "@/lib/timeline/discover";
import { extractNativePdfPages } from "@/lib/timeline/extract";
import { digest, ingestDocuments } from "@/lib/timeline/ingest";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!secretMatches(authorization, process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined)) return new Response("Unauthorized", { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  let store;
  let lease;
  try { store = getEvidenceStore(); lease = await acquireLease(store, "ingest"); }
  catch (error) {
    console.error("[timeline:cron] Storage unavailable", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Timeline storage is not configured or reachable" }, { status: 503 });
  }
  if (!lease) return Response.json({ status: "already running" }, { status: 409 });
  try {
    const deadline = Date.now() + 280000;
    const discovery = await discoverCaseDocuments({ store, deadline: Date.now() + 120000 });
    const run = await ingestDocuments(store, discovery.documents, { budgetMs: Math.max(0, deadline - Date.now()), text: async (bytes) => discovery.extractedPages.get(digest(bytes)) ?? extractNativePdfPages(bytes) });
    if (discovery.warnings.length) await store.mutate((state) => { state.runs[state.runs.length - 1].errors.push(...discovery.warnings); });
    const review = reviewRunSummary(await store.read(), discovery.caseIds);
    const portal = review.some((r) => r.pzAttachment.listed && !r.pzAttachment.verifiedDownload) && Date.now() < deadline - 20000 ? await nampaPublicClientHints() : undefined;
    return Response.json({ review, portal, checked: run.checked, processed: run.processed, skipped: run.skipped, errors: run.errors.length + discovery.warnings.length,
      issues: run.errors.map((message) => message.match(/Extraction API HTTP \d+(?: \([a-z0-9_]+\))?|OCR missing page \d+|Source quote not found on cited page for [a-zA-Z]+|Invalid confidence for [a-zA-Z]+|Missing evidence for [a-zA-Z]+|Document HTTP \d+|Extraction did not complete|Extraction returned no structured text|PDF exceeds [0-9]+-page processing limit|Document exceeds [0-9]+ MB limit|Expected PDF[^;.]*/)?.[0] ?? "Source or processing failure; details are in the protected review queue") }, { headers: { "Cache-Control": "no-store" } });
  } finally { await releaseLease(store, "ingest", lease); }
}
