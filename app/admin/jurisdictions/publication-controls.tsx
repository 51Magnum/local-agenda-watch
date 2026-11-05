import {publicationState} from "@/lib/jurisdictions/publication-state";
import {jurisdiction} from "@/lib/jurisdictions/registry";
import {isPreview} from "@/lib/runtime-environment";
export default async function PublicationControls({areaId}:{areaId:string}){
 if(isPreview())return <p>Publication changes are not available in preview.</p>;
 const name=jurisdiction(areaId)?.name??areaId;
 let state;try{state=await publicationState(areaId);}catch{return <p role="alert">{name}: publication status is unavailable. No publication change was made.</p>;}
 return <section className="space-y-2 rounded border p-3" aria-label={name+" publication status"}>
  <h3 className="font-semibold">{name}: {state.publiclyVisible?"Public":state.status==="paused"?"Paused":"Not public"}</h3>
  <p>{state.reason}</p><p>{state.publishedRecords} eligible records · Self-check {state.checksPassed?"passing":"not passing"}</p>
  {state.status!=="missing"&&<form action="/admin/review/jurisdiction-action" method="post">
   <input type="hidden" name="areaId" value={areaId}/>
   <button className="min-h-11 rounded border px-4 py-2 disabled:opacity-50" name="action" value={state.status==="paused"?"resume":"pause"} disabled={state.status==="paused"&&!state.canResume}>{state.status==="paused"?"Resume publication":"Pause publication"}</button>
  </form>}
 </section>;
}
