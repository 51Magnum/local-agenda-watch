import type {StagingSnapshot} from "./store";
export function locationMetrics(snapshot:StagingSnapshot){
 const applications=snapshot.applications,items=snapshot.meetings.flatMap(m=>m.items).filter(i=>i.caseNumbers.length),located=applications.filter(a=>!!a.geometry);
 return {geometryMatchRate:applications.length?located.length/applications.length:0,applicationsWithoutGeometry:applications.length-located.length,applicationsWithoutAddress:applications.filter(a=>!a.address.trim()).length,agendaItemsWithoutMatchedLocation:items.filter(i=>!applications.some(a=>([a.recordId,...a.relatedCaseNumbers].some(id=>i.caseNumbers.includes(id))||i.matchedApplications?.some(m=>m.recordId===a.recordId))&&(!!a.geometry||!!a.address.trim()))).length};
}
