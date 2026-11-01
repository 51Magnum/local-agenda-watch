import type {MapCase} from "./maps/types";
/** A review signal, never a claim that a name is an individual or an automatic approval. */
export function titleReviewReason(title:string){
 if(/\b(?:LLC|Inc\.?|Ltd\.?|Corp\.?|Law Office|Law Firm|Company|Holdings|Enterprises|Associates|Dental|Realty)\b/i.test(title))return "Title may be a business name; verify that it explains the proposal.";
 if(/^(?:[A-Z][a-z]+(?:['’-][A-Z]?[a-z]+)?\s+){1,3}[A-Z][a-z]+$/.test(title)&&!/\b(?:Creek|Ridge|Subdivision|Landing|Heights|Park|Village|Meadows|Estates|Road|Street|Annexation|Rezone|Permit|Plan|District|County|City|Canyon|Valley|Center|Centre|Commons|Crossing|Acres|Orchard|Hills)\b/i.test(title))return "Title may be a person's name; review against the official proposal.";
}
/** Parcel join keys stay in source/GIS storage, never resident-facing collected artifacts. */
export function residentMapCase(item:MapCase):MapCase{
 const safe={...item,summary:residentDescription(item.summary)};if(item.popup)safe.popup={...item.popup,explanation:item.popup.explanation?residentDescription(item.popup.explanation)||undefined:undefined};delete safe.parcelIds;delete safe.parcelNamespace;return safe;
}
export function collectedTitleReview(title:string){const reason=titleReviewReason(title);return reason?{status:"pending" as const,reason}:undefined;}
export function residentDescription(value:string){return /\bparcel details\b|\b(?:section|township|range)\b.*\b(?:\d|parcel)\b/i.test(value)?"":value;}

export function residentPaneData(data:import("./maps/project-questions").PaneData){const safe={...data,item:residentMapCase(data.item)};delete safe.parcels;return safe;}
