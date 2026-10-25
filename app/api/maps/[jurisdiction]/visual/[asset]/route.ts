import { createHash } from "node:crypto";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { PREVIEW_VERSION,visualPreview } from "@/lib/maps/preview-crop";
import { readVisualAsset,saveVisualAsset } from "@/lib/maps/visual-store";
import { imageAssetIsActive } from "@/lib/maps/image-review-store";
import { approvedImageCheck } from "@/lib/maps/image-policy";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex","X-Content-Type-Options":"nosniff"};
export async function GET(_request:Request,{params}:{params:Promise<{jurisdiction:string;asset:string}>}){
 const {jurisdiction,asset}=await params;
 if(!getJurisdiction(jurisdiction)||! /^[a-f0-9]{64}$/.test(asset))return new Response("Image not found",{status:404,headers});
 const src="/api/maps/"+jurisdiction+"/visual/"+asset;
 try{if(!await imageAssetIsActive(jurisdiction,src))return new Response("Image removed pending privacy verification",{status:410,headers});
 const stored=await readVisualAsset(jurisdiction,asset);if(!stored||!approvedImageCheck(stored.approval))return new Response("Image unavailable",{status:410,headers});
 if(stored.approval.generated&&!stored.generated)return new Response("Image unavailable",{status:410,headers});
 const bytes=Buffer.from(stored.image,"base64");if(createHash("sha256").update(bytes).digest("hex")!==stored.approval!.pageHash)return new Response("Image unavailable",{status:410,headers});
 if(!stored.generated&&new URL(_request.url).searchParams.get("preview")===PREVIEW_VERSION){
  let preview=stored.preview;
  if(!preview||preview.version!==PREVIEW_VERSION||preview.parentHash!==stored.approval.pageHash||createHash("sha256").update(Buffer.from(preview.image,"base64")).digest("hex")!==preview.hash){
   preview=await visualPreview(bytes,stored.approval.pageHash);await saveVisualAsset(jurisdiction,asset,{...stored,preview});
  }
  return new Response(Buffer.from(preview.image,"base64"),{headers:{...headers,"Content-Type":"image/webp"}});
 }
 return new Response(bytes,{headers:{...headers,"Content-Type":"image/webp"}});
 }catch{return new Response("Image unavailable",{status:503,headers});}
}
