import {gzipSync} from "node:zlib";
import {visibleCoverageAreas} from "@/lib/areas/registry";
import {boundaryVersion,buildAreaBoundaries} from "@/lib/maps/area-boundaries";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cache=new Map<string,{json:Uint8Array;gzip:Uint8Array}>();
export async function GET(request:Request){
 const areas=await visibleCoverageAreas(),version=boundaryVersion(areas),etag=`W/"${version}"`;
 const headers={"Cache-Control":"public, no-cache, must-revalidate","Vary":"Accept-Encoding","ETag":etag,"X-LAW-Boundary-Version":version};
 if(request.headers.get("if-none-match")?.split(",").map(v=>v.trim()).includes(etag))return new Response(null,{status:304,headers});
 let encoded=cache.get(version);
 if(!encoded){const json=new TextEncoder().encode(JSON.stringify(buildAreaBoundaries(areas)));encoded={json,gzip:new Uint8Array(gzipSync(json))};cache.set(version,encoded);if(cache.size>4)cache.delete(cache.keys().next().value!);}
 const gzip=/(?:^|[,\s])gzip(?:[,\s;]|$)/i.test(request.headers.get("accept-encoding")??"")&&!/gzip\s*;\s*q=0(?:\.0+)?(?:\s*,|\s*$)/i.test(request.headers.get("accept-encoding")??"");
 return new Response(new Uint8Array(gzip?encoded.gzip:encoded.json),{headers:{...headers,"Content-Type":"application/json; charset=utf-8",...gzip?{"Content-Encoding":"gzip"}:{}}});
}
