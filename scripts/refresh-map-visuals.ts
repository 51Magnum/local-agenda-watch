import { JURISDICTIONS } from "../lib/maps/jurisdictions";
import { readMapSnapshot,saveMapSnapshot } from "../lib/maps/store";
import { refreshCaseVisual } from "../lib/maps/visuals";
import { caseCatalog } from "../lib/case-catalog";
async function main(){
  const config=JURISDICTIONS.nampa,snapshot=await readMapSnapshot(config.id);if(!snapshot)throw new Error("Refresh map data first");
  const deadline=Date.now()+100000;
  const [feed,reports]=await Promise.all([config.loadCases!(),config.loadCaseReports?.(Date.now()+18000)??[]]);
  const filter=new Set(process.argv.slice(2));const hearings=caseCatalog(feed).filter(h=>!filter.size||filter.has(h.appId));
  let images=0;
  for(const hearing of hearings){
    if(Date.now()>deadline-16000)break;
    const item=snapshot.cases.find(c=>c.id===hearing.appId);if(!item||config.caseVisuals?.[item.id])continue;
    try{const visual=await refreshCaseVisual(config,hearing,deadline,reports.filter(r=>r.caseIds.includes(hearing.appId)));if(visual){item.visual=visual;images++;console.log("Image cached:",hearing.appId);}item.visualCheckedAt=new Date().toISOString();}catch{console.log("No preview available:",hearing.appId);}
  }
  await saveMapSnapshot(snapshot);console.log(JSON.stringify({images,sourceReports:reports.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
