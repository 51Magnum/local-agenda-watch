import {refreshTimelines} from "../lib/timeline/refresh";
import {acquireLease,getEvidenceStore,releaseLease} from "../lib/timeline/store";
async function main() {
  const store = getEvidenceStore();
  const lease = await acquireLease(store, "ingest");
  if (!lease) throw new Error("Another ingestion job is running");
  try {
    const {run,maps}=await refreshTimelines(store,{discoverOnly:process.argv.includes("--discover-only")});
    console.log(JSON.stringify({...run,maps},null,2));
    if(run.errors.length)process.exitCode=1;
  } finally { await releaseLease(store, "ingest", lease); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Sync failed"); process.exitCode = 1; });
