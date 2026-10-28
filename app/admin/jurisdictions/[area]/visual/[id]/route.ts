import {authorizedReviewer} from "@/lib/timeline/auth";
import {readVisualAsset} from "@/lib/maps/visual-store";
import {approvedImageCheck} from "@/lib/maps/image-policy";
export async function GET(request:Request,{params}:{params:Promise<{area:string;id:string}>}){if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});const {area,id}=await params;if(!/^[a-f0-9]{64}$/.test(id))return new Response("Not found",{status:404});const asset=await readVisualAsset(area,id);if(!asset||!approvedImageCheck(asset.approval))return new Response("Not found",{status:404});return new Response(Buffer.from(asset.image,"base64"),{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store"}});}
