import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { readVisualAsset } from "@/lib/maps/visual-store";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{jurisdiction:string;asset:string}>}){
  const {jurisdiction,asset}=await params;
  if(!getJurisdiction(jurisdiction)||! /^[a-f0-9]{64}$/.test(asset))return new Response("Image not found",{status:404});
  try{const stored=await readVisualAsset(jurisdiction,asset);if(!stored)return new Response("Image not found",{status:404});
    return new Response(Buffer.from(stored.image,"base64"),{headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"}});
  }catch{return new Response("Image temporarily unavailable",{status:503,headers:{"Cache-Control":"no-store"}});}
}
