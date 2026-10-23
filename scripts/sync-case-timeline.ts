import { refreshConfiguredMaps } from "../lib/maps/refresh";
import { discoverCaseDocuments } from "../lib/timeline/discover";
import { ingestDocuments, digest } from "../lib/timeline/ingest";
import { extractNativePdfPages } from "../lib/timeline/extract";
import { acquireLease, getEvidenceStore, releaseLease } from "../lib/timeline/store";
async function main() {
  const store = getEvidenceStore();
  const lease = await acquireLease(store, "ingest");
  if (!lease) throw new Error("Another ingestion job is running");
  try {
    const maps = await refreshConfiguredMaps();
    const discovery = await discoverCaseDocuments({ store });
    const documents = process.argv.includes("--discover-only") ? discovery.documents.filter((document) => document.content !== undefined) : discovery.documents;
    const run = await ingestDocuments(store, documents, { text: async (bytes) => discovery.extractedPages.get(digest(bytes)) ?? extractNativePdfPages(bytes) });
    if (discovery.warnings.length) await store.mutate((state) => { state.runs[state.runs.length - 1].errors.push(...discovery.warnings); });
    console.log(JSON.stringify({ ...run, maps, discovered: discovery.documents.length, warnings: discovery.warnings }, null, 2));
    if (run.errors.length) process.exitCode = 1;
  } finally { await releaseLease(store, "ingest", lease); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Sync failed"); process.exitCode = 1; });
