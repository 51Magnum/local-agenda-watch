import "server-only";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {readImageReview,imageReviews,updateImageCrop} from "./image-review-store";
import {readVisualAsset,saveVisualAsset} from "./visual-store";
import {approvedImageCheck,imageCaption} from "./image-policy";
import {manualPreview,visualPreview,type PreviewCrop} from "./preview-crop";
import {classifyImagePage} from "./classify-image";
import {withJurisdictionAi} from "../jurisdictions/ai-budget";
import {requireProductionMutation} from "../runtime-environment";
import {residentialCase} from "../residential-privacy";
import {privacyOverrides} from "../residential-privacy-store";
export async function cropSource(id:string){
 const row=await readImageReview(id);if(!row?.visual||row.outcome!=="accepted"||!approvedImageCheck(row.visual.approval)||row.visual.approval.generated)throw Error("Only privacy-approved source pages can be cropped.");
 const overrides=await privacyOverrides();if(row.caseIds.some(caseId=>residentialCase(row.areaId,caseId,{title:row.title},overrides)))throw Error("This case is protected by residential privacy.");
 const sourceAssetId=row.cropSourceAssetId??row.visual.src.match(/\/visual\/([a-f0-9]{64})$/)?.[1];
 if(!sourceAssetId||!/^[a-f0-9]{64}$/.test(sourceAssetId))throw Error("An approved full source page is required.");
 const asset=await readVisualAsset(row.areaId,sourceAssetId);
 if(!asset||!approvedImageCheck(asset.approval)||asset.generated||asset.approval.pageHash!==row.visual.approval.pageHash)throw Error("The source page must pass the current privacy check.");
 const bytes=Buffer.from(asset.image,"base64");if(createHash("sha256").update(bytes).digest("hex")!==asset.approval.pageHash)throw Error("The source page changed; review it again.");
 if((await imageReviews(row.areaId,row.caseIds)).some(r=>r.minimumReviewerVersion&&r.minimumReviewerVersion!==asset.approval?.reviewerVersion))throw Error("The source page needs the current privacy review.");
 const meta=await sharp(bytes,{limitInputPixels:25000000}).metadata();
 return {row,asset,bytes,sourceAssetId,width:meta.width!,height:meta.height!};
}
export async function saveManualImageCrop(id:string,box:PreviewCrop|undefined,actor:string,reset=false,expectedPageHash?:string){
 requireProductionMutation();if(actor!=="admin")throw Error("Authenticated admin required.");
 const source=await cropSource(id),{row,asset,bytes,sourceAssetId}=source;
 if(expectedPageHash&&expectedPageHash!==asset.approval!.pageHash)throw Error("Source changed; reload before cropping.");
 const preview=reset?await visualPreview(bytes,asset.approval!.pageHash):await manualPreview(bytes,box!,asset.approval!.pageHash);
 // A crop has a new pixel hash. It receives the same production privacy classifier and budgets as other images.
 const check=await withJurisdictionAi({areaId:row.areaId,mode:"monthly"},()=>classifyImagePage(Buffer.from(preview.image,"base64"),asset.approval!.type,asset.approval!.sourceDate??undefined));
 if(!approvedImageCheck(check)||check.pageHash!==preview.hash)throw Error("The new crop did not pass its personal-information check. The existing image was kept.");
 preview.approval=check;
 const assetId=createHash("sha256").update(JSON.stringify([row.id,sourceAssetId,preview.hash,preview.crop,reset?"auto":"manual"])).digest("hex");
 await saveVisualAsset(row.areaId,assetId,{...asset,preview});
 const src="/api/maps/"+row.areaId+"/visual/"+assetId,visual={...row.visual!,src,fullSizeUrl:src,previewApproval:check,label:imageCaption(check),alt:imageCaption(check),kind:check.type==="vicinity/aerial exhibit"||check.is_context_map?"context" as const:"proposal" as const};
 await updateImageCrop(row.id,row.visual!.src,visual,sourceAssetId,reset?undefined:{box:preview.crop,sourceAssetId,sourcePageHash:asset.approval!.pageHash,previewHash:preview.hash,actor,at:new Date().toISOString()},row.visual!.approval);
 return {areaId:row.areaId,caseIds:row.caseIds,src,manual:!reset,box:preview.crop};
}
