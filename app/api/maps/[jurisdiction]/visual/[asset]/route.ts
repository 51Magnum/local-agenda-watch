import { createHash } from "node:crypto";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { readVisualAsset } from "@/lib/maps/visual-store";
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
 const bytes=Buffer.from(stored.image,"base64");if(createHash("sha256").update(bytes).digest("hex")!==stored.approval!.pageHash)return new Response("Image unavailable",{status:410,headers});
 return new Response(bytes,{headers:{...headers,"Content-Type":"image/webp"}});
 }catch{return new Response("Image unavailable",{status:503,headers});}
}
