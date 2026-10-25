export const IMAGE_CHECK_VERSION = "privacy-allowlist-v1";
export const IMAGE_TYPES = ["site plan", "preliminary plat", "concept plan", "landscape plan", "building elevation", "rendering", "vicinity/aerial exhibit"] as const;
export type ImageCheck = { version:string; pageHash:string; type:string; contains_personal_info:boolean; confidence:number; checkedAt:string; sourceDate?:string|null; attempts?:number; failedAt?:string;reviewerVersion?:string;contains_handwriting?:boolean;contains_signatures?:boolean;is_context_map?:boolean; generated?:"gis-boundary-v1" };
export const forbiddenImageDocument = /sign[\s_-]*in|sign[\s_-]*up|neighbou?rhood[\s_-]*meeting|attendance|affidavit|mailing[\s_-]*list|comment[\s_-]*letter|\bletter\b|\bnotice\b|application|\bforms?\b|handwrit/i;
export const planImageDocument = /site[\s_-]*(?:plan|layout)|lot[\s_-]*layout|(?:preliminary[\s_-]*)?plat|concept|landscape[\s_-]*plan|elevation|rendering|exhibit|vicinity|aerial/i;
export function allowedImageTitle(title:string) { return planImageDocument.test(title) && !forbiddenImageDocument.test(title); }
export function approvedImageCheck(check:ImageCheck|undefined):check is ImageCheck {
 return Boolean(check && check.version===IMAGE_CHECK_VERSION && /^[a-f0-9]{64}$/.test(check.pageHash) && ((IMAGE_TYPES as readonly string[]).includes(check.type) || (check.type==="project area map" && check.generated==="gis-boundary-v1")) && check.contains_personal_info===false && check.contains_handwriting!==true && check.contains_signatures!==true && Number.isFinite(check.confidence) && check.confidence>=.8 && check.confidence<=1);
}
export function imageCaption(check:ImageCheck) {
 if(check.generated==="gis-boundary-v1")return "Project area map (not a site plan)";
 const title=check.type.charAt(0).toUpperCase()+check.type.slice(1);
 const date=check.sourceDate;
 return title+(date&&/^\d{4}-\d{2}(?:-\d{2})?$/.test(date)?" · "+new Intl.DateTimeFormat("en-US",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date.slice(0,7)+"-01T12:00:00Z")):date&&/^\d{4}$/.test(date)?" · "+date:"");
}

export function imageCheckExpired(check:ImageCheck, now=Date.now()) {
 return ["unchecked","classification unavailable"].includes(check.type) && (!Number.isFinite(Date.parse(check.checkedAt)) || now-Date.parse(check.checkedAt)>=86400000);
}
