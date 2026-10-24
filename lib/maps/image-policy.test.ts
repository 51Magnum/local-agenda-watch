import {expect,it} from "vitest";
import {IMAGE_CHECK_VERSION,approvedImageCheck,imageCaption,type ImageCheck} from "./image-policy";
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
