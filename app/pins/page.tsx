import Link from "next/link";
import {requireResident} from "@/lib/resident-session";
import {residentPins,residentPlan} from "@/lib/resident-account";
import {safeReturnTo} from "@/lib/resident-auth";
import ResidentPins from "@/app/components/resident-pins";
export const dynamic="force-dynamic";
export const metadata={title:"Your pins",robots:{index:false,follow:false}};
export default async function Pins({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const params=await searchParams,query=new URLSearchParams(Object.entries(params).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));
 const resident=await requireResident(safeReturnTo("/pins?"+query)),pins=await residentPins(resident),plan=await residentPlan(resident);
 const lng=Number(params.lng),lat=Number(params.lat),radius=Number(params.radius??1),draft=params.lng!==undefined&&params.lat!==undefined&&Number.isFinite(lng)&&Number.isFinite(lat)&&Math.abs(lng)<=180&&Math.abs(lat)<=85?{id:"",source:"saved" as const,label:(params.label??"Map pin").slice(0,300),coordinates:[lng,lat] as [number,number],radiusMiles:radius>=.25&&radius<=10?radius:1}:undefined;
 return <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12"><nav className="flex flex-wrap gap-5"><Link href="/">Public map</Link><Link href="/profile" className="underline">Your profile</Link><form action="/api/auth/sign-out" method="post"><button className="underline">Sign out</button></form></nav><h1 className="text-3xl font-semibold">Your pins</h1>{params.saved&&<p role="status">Your changes were saved.</p>}<ResidentPins pins={pins} plan={plan} draft={draft} returnTo="/pins"/></main>;
}
