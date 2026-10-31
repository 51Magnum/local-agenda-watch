import {getArea,areaPath,visibleAreas} from "../areas/registry";
import {privateProject} from "./preview";
import {residentialCase,protectMapCase,redactResidence,privateResidentialDocument} from "../residential-privacy";
import {privacyOverrides} from "../residential-privacy-store";
import {readPublished} from "./self-check-store";
import {jurisdiction} from "./registry";
/** Resident projection shares the sourced six-question record without admin links. */
export async function residentProject(areaId:string,caseId:string){
 await visibleAreas();
 const area=getArea(areaId);if(!area)return null;
 const snapshot=await readPublished(areaId);if(!snapshot)return null;
 if(!snapshot.applications.some(a=>a.recordId===caseId||a.relatedCaseNumbers.includes(caseId)))return null;
 const data=await privateProject(areaId,caseId,snapshot);if(!data)return null;
 data.item.href=areaPath(area)+"/plan/"+encodeURIComponent(data.item.id);data.item.areaId=areaId;
 data.relatedCases=data.relatedCases?.map(c=>({...c,href:areaPath(area)+"/plan/"+encodeURIComponent(c.caseId)}));
 data.item.stage=data.next?/board|council/i.test(data.next.body)?"Council/Board":"P&Z":"In review";
 // Staged image assets have not been published through the public image-review queue.
 data.item.visual=undefined;
 if(!data.where&&data.item.geometry)data.where="Unincorporated "+area.name+" · official parcel boundary shown on the map";
 const overrides=await privacyOverrides();
 if((jurisdiction(areaId)?.legacyPublic?residentialCase(areaId,data.item.id,{...data.item,appScope:data.item.summary},overrides):data.item.residentialPrivacy)||overrides[areaId+"/"+data.item.id]?.mode==="protect"){
  data.item=protectMapCase(areaId,{...data.item,residentialPrivacy:true},overrides);data.where="Approximate residential area; exact address withheld.";
  data.documents=data.documents?.filter(d=>!privateResidentialDocument(d.label));return redactResidence(data);
 }
 return data;
}
