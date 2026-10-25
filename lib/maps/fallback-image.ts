import {createHash} from "node:crypto";
import {bbox} from "@turf/turf";
import sharp from "sharp";
import {saveVisualAsset,readVisualAsset} from "./visual-store";
import {publishCaseImage} from "./image-review-store";
import {IMAGE_CHECK_VERSION} from "./image-policy";
import type {MapCase,MapVisual} from "./types";
const IMAGERY="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
const attribution="Imagery: Esri, Maxar, Earthstar Geographics, GIS User Community";
export function mercator([x,y]:number[]){return [x*20037508.34/180,Math.log(Math.tan((90+Math.max(-85,Math.min(85,y)))*Math.PI/360))*20037508.34/Math.PI];}
export async function fallbackCaseImage(areaId:string,item:MapCase):Promise<MapVisual|undefined>{
 if(!item.geometry||item.citywide)return;
 const geometryHash=createHash("sha256").update(JSON.stringify(item.geometry)).digest("hex"),id=createHash("sha256").update("gis-boundary-v1"+areaId+item.id+geometryHash).digest("hex"),src="/api/maps/"+areaId+"/visual/"+id;
 let asset=await readVisualAsset(areaId,id);
 if(!asset?.generated){
  const b=bbox(item.geometry),lo=mercator([b[0],b[1]]),hi=mercator([b[2],b[3]]),cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2;
  let w=Math.max(hi[0]-lo[0],250)*1.5,h=Math.max(hi[1]-lo[1],160)*1.5;w=Math.max(w,h*1000/650);h=w*650/1000;
  const bounds=[cx-w/2,cy-h/2,cx+w/2,cy+h/2],url=new URL(IMAGERY);for(const[k,v]of Object.entries({bbox:bounds.join(","),bboxSR:"3857",imageSR:"3857",size:"1000,650",format:"jpg",f:"image"}))url.searchParams.set(k,v);
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok||!r.headers.get("content-type")?.startsWith("image/"))throw new Error("Aerial imagery unavailable");const aerial=Buffer.from(await r.arrayBuffer());
  const polygons=item.geometry.type==="Polygon"?[item.geometry.coordinates]:item.geometry.coordinates;
  const drawing=polygons.map(polygon=>polygon.map(ring=>ring.map((p,i)=>{const [x,y]=mercator(p);return(i?"L":"M")+((x-bounds[0])/w*1000).toFixed(1)+","+((bounds[3]-y)/h*650).toFixed(1);}).join(" ")+" Z").join(" ")).join(" ");
  const overlay=Buffer.from(`<svg width="1000" height="650"><path d="${drawing}" fill="#06b6d4" fill-opacity=".10" fill-rule="evenodd" stroke="white" stroke-width="7"/><path d="${drawing}" fill="none" stroke="#00c8ef" stroke-width="4"/><rect x="0" y="608" width="1000" height="42" fill="#000" fill-opacity=".8"/><text x="16" y="627" fill="white" font-family="sans-serif" font-size="14">Project area map (not a site plan)</text><text x="16" y="643" fill="white" font-family="sans-serif" font-size="11">${attribution}</text></svg>`);
  const image=await sharp(aerial).resize(1000,650).composite([{input:overlay}]).webp({quality:82}).toBuffer();const pageHash=createHash("sha256").update(image).digest("hex");
  asset={image:image.toString("base64"),generated:{geometryHash,imageryUrl:url.href,attribution},approval:{version:IMAGE_CHECK_VERSION,type:"project area map",generated:"gis-boundary-v1",pageHash,contains_personal_info:false,confidence:1,checkedAt:new Date().toISOString()}};await saveVisualAsset(areaId,id,asset);
 }
 const visual:MapVisual={src,fullSizeUrl:src,approval:asset.approval,label:"Project area map (not a site plan)",alt:"Aerial imagery with the project boundary outlined",sourceUrl:item.href,documentTitle:"GIS project boundary over aerial imagery",kind:"context"};await publishCaseImage(areaId,[item.id],visual);return visual;
}
