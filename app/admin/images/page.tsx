import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { imageReviews, displayedImageReviews } from "@/lib/maps/image-review-store";
import { AREAS } from "@/lib/areas/registry";
export const dynamic="force-dynamic";
export const metadata={title:"Image privacy review",robots:{index:false,follow:false}};
export default async function ImagesPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 if(!authorizedReviewer((await headers()).get("authorization")))return <main>Review access requires the admin password.</main>;
 const query=await searchParams,rows=await imageReviews(query.area,query.case?[query.case]:undefined);
 const displayed=displayedImageReviews(rows);
 return <main className="mx-auto max-w-6xl space-y-6 p-8"><h1 className="text-3xl font-semibold">{query.case?query.case+" · ":""}Image privacy review</h1><nav className="flex gap-5 underline"><Link href="/admin/review">Case evidence</Link><Link href="/admin/images">All images</Link></nav><p>{displayed.length} displayed images. Unchecked, rejected and hidden images are never published.</p><div className="grid gap-6 md:grid-cols-2">{displayed.map(r=><article key={r.id} className="space-y-3 rounded-xl border p-5"><Image src={r.visual!.src} alt={r.visual!.label} width={480} height={220} unoptimized className="max-h-56 object-contain"/><h2 className="font-semibold">{r.visual!.label} · {AREAS[r.areaId]?.name}</h2><p className="text-sm">{r.title}</p><div className="flex flex-wrap gap-3">{r.caseIds.map(id=><Link key={id} href={"/admin/images/"+r.areaId+"/"+encodeURIComponent(id)} className="underline">{id}</Link>)}</div><a href={r.sourceUrl} className="text-sm underline">Official source page</a><p className="text-xs">Classifier confidence: {r.visual!.approval!.confidence} · Personal information: false</p><form action="/admin/images/action" method="post"><input type="hidden" name="action" value="hide"/><input type="hidden" name="id" value={r.id}/><button className="rounded-md border border-red-600 px-4 py-2 text-red-700">Hide image</button></form></article>)}</div><details><summary>Withdrawn / rejected / hidden ({rows.length-displayed.length})</summary><ul className="mt-4 space-y-3">{rows.filter(r=>!displayed.includes(r)).map(r=><li key={r.id} className="text-sm">{AREAS[r.areaId]?.name} · {r.caseIds.join(", ")} · {r.hidden?"Hidden":r.outcome} · {r.reason}</li>)}</ul></details></main>;
}
