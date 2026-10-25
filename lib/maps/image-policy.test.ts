import {expect,it} from "vitest";
import {imageCheckExpired,IMAGE_CHECK_VERSION,approvedImageCheck,imageCaption,type ImageCheck} from "./image-policy";
import {displayedImageReviews,type ImageReview} from "./image-review-store";
const check:ImageCheck={version:IMAGE_CHECK_VERSION,pageHash:"a".repeat(64),type:"site plan",contains_personal_info:false,confidence:.8,checkedAt:"2026-10-24",sourceDate:"2026-09"};
it("fails closed for unchecked, old, disallowed, private and low-confidence pages",()=>{
 expect(approvedImageCheck(check)).toBe(true);
 for(const value of [undefined,{...check,version:"old"},{...check,type:"staff report text"},{...check,contains_personal_info:true},{...check,confidence:.79},{...check,confidence:NaN}])expect(approvedImageCheck(value)).toBe(false);
 expect(imageCaption(check)).toBe("Site plan · Sep 2026");expect(imageCaption({...check,sourceDate:undefined})).toBe("Site plan");
});
it("a Hide image action remains effective if collection creates another record for the same source",()=>{
 const row={id:"one",areaId:"nampa",caseIds:["CUP-00415-2026"],sourceUrl:"https://city.test/plan.pdf",outcome:"accepted",visual:{approval:check}} as ImageReview;
 expect(displayedImageReviews([row])).toHaveLength(1);
 expect(displayedImageReviews([row,{...row,id:"older",hidden:true}])).toHaveLength(0);
 expect(displayedImageReviews([{...row,hidden:true},{...row,id:"new",visual:{...row.visual!,src:"new-asset"}}])).toHaveLength(0);
});

it("only expires transient image checks after 24 hours",()=>{
 const now=Date.parse("2026-10-25T12:00:00Z");
 expect(imageCheckExpired({...check,type:"unchecked",checkedAt:"2026-10-24T12:00:00Z"},now)).toBe(true);
 expect(imageCheckExpired({...check,type:"classification unavailable",checkedAt:"2026-10-25T11:59:00Z"},now)).toBe(false);
 expect(imageCheckExpired({...check,type:"rejected",checkedAt:"2026-10-01"},now)).toBe(false);
});
it("keeps a manually selected image ahead of later automated plans and fallback maps",()=>{
 const row={areaId:"nampa",caseIds:["A"],outcome:"accepted",checkedAt:"2026-10-24",visual:{approval:check}} as ImageReview;
 const manual={...row,id:"manual",manual:true,selected:true,sourceUrl:"one",visual:{approval:{...check,type:"vicinity/aerial exhibit"}}};
 const automatic={...row,id:"auto",sourceUrl:"two"};const fallback={...row,id:"fallback",sourceUrl:"three",visual:{approval:{...check,type:"project area map",generated:"gis-boundary-v1" as const}}};
 expect(displayedImageReviews([fallback,automatic,manual] as ImageReview[]).map(r=>r.id)).toEqual(["manual","auto","fallback"]);
 expect(approvedImageCheck({...check,type:"project area map"})).toBe(false);
});
