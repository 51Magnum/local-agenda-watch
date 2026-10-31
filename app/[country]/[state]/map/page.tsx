import {visibleAreas} from "@/lib/areas/registry";
import {notFound} from "next/navigation";
import Link from "next/link";

import CaseMap from "@/app/components/maps/case-map";
import type {Metadata} from "next";
type Params={country:string;state:string};
export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{const p=await params;return {title:"Projects near you",alternates:{canonical:`https://www.localagendawatch.com/${p.country}/${p.state}/map`},robots:{index:false,follow:true}};}
export default async function NearbyMap({params}:{params:Promise<Params>}){
 const p=await params,areas=(await visibleAreas()).filter(a=>a.country===p.country&&a.state===p.state&&a.status==="live");if(!areas.length)notFound();
 return <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-xl font-semibold">Projects near you</h1><Link href={`/${p.country}/${p.state}`} className="text-sm underline">Covered areas →</Link></div><CaseMap jurisdiction={areas[0].id} combined={{country:p.country,state:p.state}} fullPage showNearbyList/></main>;
}
