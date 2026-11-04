import {headers} from "next/headers";
import Link from "next/link";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {cropSource} from "@/lib/maps/manual-image-crop";
import CropEditor from "../crop-editor";
export const dynamic="force-dynamic";
export default async function ImageCrop({params}:{params:Promise<{id:string}>}){
 if(!authorizedReviewer((await headers()).get("authorization")))return <main>Admin access required.</main>;
 const {id}=await params;let source;try{source=await cropSource(id);}catch{return <main className="space-y-4 p-6"><h1>Image crop unavailable</h1><p>This image needs an approved full source page and a current privacy check before it can be cropped.</p><Link href="/admin/images" className="underline">Return to image review</Link></main>;}
 return <main className="space-y-5 p-6"><h1 className="text-3xl font-semibold">Crop image · {source.row.caseIds.join(", ")}</h1><p>Drag across the full source page to choose the preview. Keep the plan’s legend, orientation, scale and labels legible. The original source page is preserved.</p><p>{source.row.title} · {source.row.manualCrop?"Manually cropped":"Automatic crop"}</p><a className="underline" href={source.row.sourceUrl}>Official source document</a><CropEditor id={id} width={source.width} height={source.height} sourcePageHash={source.asset.approval!.pageHash} initial={source.row.manualCrop?.box??source.asset.preview?.crop??{left:0,top:0,width:source.width,height:source.height}}/><Link className="underline" href={"/admin/images/"+source.row.areaId+"/"+encodeURIComponent(source.row.caseIds[0])}>Return to this case’s images</Link></main>;
}
