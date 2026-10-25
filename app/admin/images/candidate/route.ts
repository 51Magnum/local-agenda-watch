import {authorizedReviewer} from "@/lib/timeline/auth";
import {readImageReview} from "@/lib/maps/image-review-store";
import {readVisualAsset} from "@/lib/maps/visual-store";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex","X-Content-Type-Options":"nosniff"};if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401,headers});const id=new URL(request.url).searchParams.get("id"),r=id?await readImageReview(id):undefined;const asset=r?.visual?.src.split("/").at(-1);if(!r||!asset||!/^[a-f0-9]{64}$/.test(asset))return new Response("Not found",{status:404,headers});const data=await readVisualAsset(r.areaId,asset);return data?new Response(Buffer.from(data.image,"base64"),{headers:{...headers,"Content-Type":"image/webp"}}):new Response("Not found",{status:404,headers});}
