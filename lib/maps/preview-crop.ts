import sharp from "sharp";
import {createHash} from "node:crypto";
export const PREVIEW_VERSION="main-v1";
export type PreviewCrop={left:number;top:number;width:number;height:number};
export type VisualPreview={version:string;parentHash:string;hash:string;image:string;crop:PreviewCrop};
function bands(values:number[],threshold:number,gap:number,min:number){
 const result:{start:number;end:number}[]=[];let start=-1,last=-1;
 for(let i=0;i<values.length;i++)if(values[i]>=threshold){if(start<0)start=i;else if(i-last>gap){if(last-start+1>=min)result.push({start,end:last+1});start=i;}last=i;}
 if(start>=0&&last-start+1>=min)result.push({start,end:last+1});return result;
}
/** Deterministic crop of an already privacy-approved page. No generated imagery. */
export async function cropMainPanel(image:Uint8Array):Promise<{image:Buffer;crop:PreviewCrop}>{
 const meta=await sharp(image).metadata(),width=meta.width!,height=meta.height!;
 const {data,info}=await sharp(image).flatten({background:"white"}).resize({width:400,withoutEnlargement:true}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const rows=new Array(info.height).fill(0);
 const ink=(x:number,y:number)=>{const i=(y*info.width+x)*info.channels;return Math.min(data[i],data[i+1],data[i+2])<240;};
 for(let y=0;y<info.height;y++){for(let x=0;x<info.width;x++)if(ink(x,y))rows[y]++;rows[y]/=info.width;}
 // Ignore headings/rules; large dense bands are drawing/map panels. First is the main panel.
 const horizontal=bands(rows,.12,Math.max(3,Math.round(info.height*.012)),Math.max(30,info.height*.12));
 let top=horizontal[0]?.start??0,bottom=horizontal[0]?.end??info.height;
 if(!horizontal.length){top=0;bottom=info.height;}
 const cols=new Array(info.width).fill(0);
 for(let x=0;x<info.width;x++){for(let y=top;y<bottom;y++)if(ink(x,y))cols[x]++;cols[x]/=bottom-top;}
 const vertical=bands(cols,.10,Math.max(3,Math.round(info.width*.015)),Math.max(30,info.width*.15));
 const left=vertical[0]?.start??0,right=vertical[0]?.end??info.width;
 const sx=width/info.width,sy=height/info.height;
 const crop={left:Math.max(0,Math.floor(left*sx)),top:Math.max(0,Math.floor(top*sy)),width:Math.min(width,Math.ceil((right-left)*sx)),height:Math.min(height,Math.ceil((bottom-top)*sy))};
 crop.width=Math.min(crop.width,width-crop.left);crop.height=Math.min(crop.height,height-crop.top);
 const cropped=await sharp(image).extract(crop).flatten({background:"white"}).png().toBuffer();
 const trimmed=await sharp(cropped).trim({background:"#ffffff",threshold:18}).resize({width:768,height:1000,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
 return {image:trimmed,crop};
}
export async function visualPreview(image:Uint8Array,parentHash:string):Promise<VisualPreview>{
 const result=await cropMainPanel(image);return {version:PREVIEW_VERSION,parentHash,hash:createHash("sha256").update(result.image).digest("hex"),image:result.image.toString("base64"),crop:result.crop};
}
